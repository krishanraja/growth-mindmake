import { parseEngineContext, parseWorkArtifact, parseWorkBatch, CAMPAIGN_IDS } from '../contracts/engine.ts';
import { prepareMotion } from './stages/motions.mjs';
import { prepareLifecycle } from './stages/lifecycle.mjs';
import { prepareResearch } from './stages/research.mjs';
import { validateContext, ageDays, seal, semanticSnapshot } from './guards.mjs';

const CAMPAIGNS = {
  'warm-relationship': 'warm', 'double-opt-in-introduction': 'introduction', 'named-cold-decision': 'named_cold',
  'inbound-next-decision': 'inbound', 'selected-founder-trust': 'founder_visibility', 'relevant-room': 'speaking', 'practice-decision-aid': 'practice_asset'
};
const PRIORITY = { inbound: 0, delivery: 1, proof_scope: 2, qualification: 3, introduction: 4, outreach: 5, research: 6, practice: 7, trust: 8, speaking: 9 };
const AUTHORITY = 'Private draft work only. Krish reviews exact recipient, channel, wording and action. Nothing sends, publishes, spends, confirms qualification or changes a commercial outcome.';

function campaignFor(job) {
  if (job.kind === 'outreach') return job.details.mode === 'named_cold' ? 'named-cold-decision' : 'warm-relationship';
  return { introduction: 'double-opt-in-introduction', inbound: 'inbound-next-decision', qualification: 'inbound-next-decision', proof_scope: 'inbound-next-decision', delivery: 'inbound-next-decision', research: 'named-cold-decision', trust: 'selected-founder-trust', speaking: 'relevant-room', practice: 'practice-decision-aid' }[job.kind];
}
function registryCheck(registry) {
  if (!registry || registry.schemaVersion !== 1 || !Array.isArray(registry.campaigns) || registry.campaigns.length !== CAMPAIGN_IDS.length) throw new Error('Campaign registry is incomplete');
  if (!registry.defaults || registry.defaults.senderAction !== 'krish_manual_only' || registry.defaults.artifactState !== 'draft_only' || registry.defaults.maxAsksPerMessage !== 1 || registry.defaults.automaticFollowUps !== false || registry.defaults.researchCreatesOutreachQueue !== false || registry.defaults.requiresCurrentCanon !== true || registry.defaults.requiresSuppressionCheck !== true || registry.defaults.requiresContactEligibilityReview !== true || !Number.isInteger(registry.defaults.newRecommendationsPerDailyRun) || registry.defaults.newRecommendationsPerDailyRun < 1 || registry.defaults.newRecommendationsPerDailyRun > 10 || registry.defaults.maximumNewRecommendationsPerDailyRun !== 10) throw new Error('Unsafe campaign defaults');
  const ids = registry.campaigns.map(c => c.id);
  if (new Set(ids).size !== CAMPAIGN_IDS.length || CAMPAIGN_IDS.some(id => !ids.includes(id))) throw new Error('Campaign registry identity mismatch');
  for (const c of registry.campaigns) {
    if (c.mode !== CAMPAIGNS[c.id] || !Array.isArray(c.artifactTypes) || !c.artifactTypes.length || !Array.isArray(c.evidenceRequired) || !c.evidenceRequired.length || !Array.isArray(c.stopConditions) || !c.stopConditions.length || c.cta?.maxPerArtifact !== 1 || !Array.isArray(c.cta.allowedKinds) || !c.cta.allowedKinds.length) throw new Error('Campaign registry routing mismatch');
    if (c.id === 'double-opt-in-introduction' && c.bothOptInsRequiredBeforeConnecting !== true) throw new Error('Introduction permission gate missing');
    if (c.id === 'named-cold-decision' && (c.outsideInFramingRequired !== true || c.maxLinksPerColdFirstMessage !== 1)) throw new Error('Named outreach evidence gate missing');
    if (c.id === 'inbound-next-decision' && c.duplicatesLeadDeliverySequence !== false) throw new Error('Inbound service boundary missing');
  }
}
function canonicalSources(value, key = '') {
  if (Array.isArray(value)) {
    const values = value.map(v => canonicalSources(v));
    if (key === 'sources') return values.sort((a,b) => a.id.localeCompare(b.id));
    if (key === 'evidence_ids') return values.sort();
    return values;
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,canonicalSources(v,k)]));
  return value;
}
function canonicalContext(context) {
  const snapshot = { ...context.snapshot };
  snapshot.contacts = [...snapshot.contacts].sort((a,b) => a.id.localeCompare(b.id)).map(c => ({ ...c, evidence: [...c.evidence].sort((a,b) => a.id.localeCompare(b.id)) }));
  snapshot.deals = [...snapshot.deals].sort((a,b) => a.id.localeCompare(b.id));
  return { ...context, snapshot, jobs: [...context.jobs].sort((a,b) => a.id.localeCompare(b.id)).map(j => ({...j,details:canonicalSources(j.details)})) };
}
function semanticContext(context) {
  const { generated_at, ...rest } = context;
  return { ...rest, snapshot:semanticSnapshot(context.snapshot) };
}
function priority(job) { return PRIORITY[job.kind] + (job.kind === 'outreach' ? job.details.mode === 'warm' ? 0 : job.details.mode === 'follow_up' ? 0.2 : 0.4 : 0); }

export function enginePlan(input, policy, registry, { at = new Date().toISOString(), launchDate } = {}) {
  const context = canonicalContext(parseEngineContext(input));
  const snapshot = validateContext(context.snapshot,policy,at);
  const age = ageDays(context.generated_at,at) * 24;
  if (!context.complete || age < 0 || age > policy.limits.snapshot_max_age_hours) throw new Error('Engine context must be complete and current');
  if (launchDate !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(launchDate) || !Number.isFinite(Date.parse(`${launchDate}T12:00:00Z`)) || new Date(`${launchDate}T12:00:00Z`).toISOString().slice(0,10) !== launchDate)) throw new Error('Invalid activation date');
  registryCheck(registry);
  const capacity = Math.min(policy.limits.recommendations_per_run,registry.defaults.newRecommendationsPerDailyRun,registry.defaults.maximumNewRecommendationsPerDailyRun);
  const source_seal = seal(semanticContext(context));
  const items = [], held = [], recipients = new Set(), campaigns = Object.fromEntries(CAMPAIGN_IDS.map(campaign_id => [campaign_id,{ campaign_id, prepared: 0, held: 0 }]));
  const outreach_analysis = { eligible: 0, held: 0, research_needed: 0 };
  const jobs = [...context.jobs].sort((a,b) => priority(a)-priority(b) || (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999') || a.id.localeCompare(b.id));
  for (const job of jobs) {
    const campaign_id = campaignFor(job);
    const hold = reason => {
      held.push({input_id:job.id,reason}); campaigns[campaign_id].held++;
      if (job.kind === 'outreach' && reason !== 'capacity_deferred') { outreach_analysis.held++; if (/evidence|buying_moment|source|research/.test(reason)) outreach_analysis.research_needed++; }
    };
    if (job.due_at !== null && Date.parse(job.due_at) > Date.parse(at)) { hold('job_not_due'); continue; }
    if (job.contact_id !== null && !snapshot.contacts.some(c => c.id === job.contact_id)) { hold('source_contact_missing'); continue; }
    const result = ['outreach','trust','speaking','practice'].includes(job.kind) ? prepareMotion(job,snapshot,policy,at) : job.kind === 'research' ? prepareResearch(job,snapshot,policy,at) : prepareLifecycle(job,snapshot,policy,at);
    if (!result || typeof result !== 'object' || Array.isArray(result) || Object.keys(result).some(k => !['artifact','hold'].includes(k)) || Boolean(result.artifact) === Boolean(result.hold)) throw new Error('Stage returned an invalid disposition');
    if (result.hold) { hold(result.hold); continue; }
    const artifact = parseWorkArtifact(result.artifact);
    if (!registry.campaigns.find(c => c.id === campaign_id).artifactTypes.includes(artifact.kind)) { hold('campaign_artifact_type_disabled'); continue; }
    if (['email','linkedin'].includes(artifact.channel)) {
      const recipient = snapshot.contacts.find(c => c.id === artifact.recipient_contact_id);
      if (!recipient || recipient.suppressed || recipient.closed || recipient.consent_status === 'blocked') { hold('recipient_suppressed_or_unresolved'); continue; }
      if (recipients.has(recipient.id)) { hold('recipient_already_selected'); continue; }
    }
    if (job.kind === 'outreach') outreach_analysis.eligible++;
    if (items.length >= capacity) { hold('capacity_deferred'); continue; }
    const item_id = `gwi-${seal({input_id:job.id,campaign_id,contact_id:job.contact_id,artifact,canon:snapshot.canon.revision}).slice(0,32)}`;
    items.push({ ...artifact,item_id,input_id:job.id,campaign_id,contact_id:job.contact_id,requires_human:true,approval_state:'pending' }); campaigns[campaign_id].prepared++;
    if (['email','linkedin'].includes(artifact.channel)) recipients.add(artifact.recipient_contact_id);
  }
  const report = { scope:'selected_context',global:false,prepared:items.length,held:held.length,deferred:held.filter(h => h.reason === 'capacity_deferred').length,campaign_counts:CAMPAIGN_IDS.map(id => campaigns[id]),outreach_analysis,capacity,authority:AUTHORITY };
  const day = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'}).format(new Date(at));
  const run_id = `gmw-${seal({source_seal,policy,registry,day,launchDate:launchDate ?? null,items,held,report}).slice(0,40)}`;
  return parseWorkBatch({version:1,run_id,generated_at:at,source_revision:context.source_revision,canon_revision:snapshot.canon.revision,source_seal,jobs_examined:jobs.length,items,held,report});
}
