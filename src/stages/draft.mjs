import { clean, seal } from '../guards.mjs';

export function prepare(candidate, canon) {
  const { contact: c, trigger, mode, evidence, offer } = candidate;
  const fact = clean(trigger.fact);
  const company = clean(c.company);
  const first = clean(c.full_name).split(' ')[0];
  const decision = offer === 'brain' ? 'Which recurring decision would improve if your AI knew your standards and judgement?' : 'Which pricing, positioning or team decision needs a test with real buyers?';
  const scope = offer === 'brain' ? canon.brain_description : canon.revenue_description;
  let subject = `${company}: ${offer === 'brain' ? 'your AI and your judgement' : 'the AI revenue decision'}`.slice(0, 120);
  let body = `${first}, ${fact}\n\nOne question this raises: ${decision}\n\nMindmake builds a working first version around one decision or capability. ${scope}\n\nIf that decision is live, the free AI brief is a place to start: ${canon.brief_url}`;
  if (mode === 'intro') {
    subject = `A possible introduction to ${first}`.slice(0, 120);
    body = `${clean(c.connector.full_name).split(' ')[0]}, ${fact}\n\nThat made me think of ${first} and the decision at ${company}. The possible fit is ${offer === 'brain' ? 'an AI system that holds their standards and judgement' : 'testing how AI changes pricing, positioning or the team'}.\n\nWould you be comfortable checking whether a short introduction would be useful? Please ask them first. No introduction or forwarded note until you both agree.`;
  } else if (mode === 'follow_up') {
    const value = candidate.newValue;
    subject = `One addition for ${company}`.slice(0, 120);
    body = `${first}, one useful addition to the earlier note: ${clean(value.fact)}\n\n${decision}\n\nIf it helps with that decision, the free AI brief is here: ${canon.brief_url}`;
  }
  const aid = {
    title: `${company}: one decision to test`,
    body: `OBSERVATION\n${fact}\n\nPOSSIBLE IMPLICATION\n${clean(candidate.why_fit)}\n\nDECISION\n${decision}\n\nA SMALL TEST\nChoose one real piece of work. Write down the standard a good answer must meet. Build a first version, compare it with that standard and decide what to keep.\n\nWHAT TO VERIFY\nWho owns the decision, why it matters now, which evidence would change it, and what a useful first result would look like. This is an illustrative decision aid, not a finding about the business.\n\nSOURCES\n${evidence.map(e => `${e.observed_at.slice(0, 10)} | ${e.url}`).join('\n')}`
  };
  return {
    recommendation_id: `rec-${seal({ contact_id: c.id, mode, trigger, offer, canon: canon.revision, body, aid }).slice(0, 32)}`,
    contact_id: c.id, recipient_contact_id: mode === 'intro' ? c.connector.contact_id : c.id, mode, why_fit: clean(candidate.why_fit), why_now: fact,
    ask_kind: mode === 'intro' ? 'intro' : 'buyer', draft: { subject, body }, decision_aid: aid, evidence
  };
}
