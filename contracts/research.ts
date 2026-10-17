/** Explicit research intake. Supplied evidence never creates contact authority. */
export type ResearchSource = { id:string; url:string; title:string; publisher:string; event_at:string|null; retrieved_at:string; excerpt:string; claim:string; limitation:string; classification:'observed'|'inference'; layer:'narrative'|'revealed'; primary:boolean; visibility:'public'|'private' };
export type ResearchDetails = { company:string; question:string; hypothesis:string; alternative:string; decision:string; owner_role:string; next_question:string; sources:ResearchSource[]; contradictions:string[] };
function object(value:unknown, allowed:string[]) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k=>!allowed.includes(k)) || allowed.some(k=>!(k in value))) throw new Error('research: invalid fields'); return value as Record<string,unknown>; }
function text(value:unknown,max=1500) { if (typeof value !== 'string' || !value.trim() || value.length>max || value.includes('\u2014')) throw new Error('research: invalid text'); }
function date(value:unknown) { text(value,40); const s=String(value),m=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(s); if(!m||!Number.isFinite(Date.parse(s))||+m[2]>23||+m[3]>59||+m[4]>59||+(m[5]??0)>23||+(m[6]??0)>59||new Date(m[1]+'T12:00:00Z').toISOString().slice(0,10)!==m[1]) throw new Error('research: invalid timestamp'); }
export function parseResearchJob(value:unknown) {
  const job=object(value,['id','kind','contact_id','source_id','due_at','details']);
  if(job.kind!=='research') throw new Error('research: invalid kind');
  const d=object(job.details,['company','question','hypothesis','alternative','decision','owner_role','next_question','sources','contradictions']);
  for(const k of ['company','question','hypothesis','alternative','decision','owner_role','next_question']) text(d[k]);
  if(!Array.isArray(d.sources)||d.sources.length>10||!Array.isArray(d.contradictions)||d.contradictions.length>10) throw new Error('research: invalid ledger size');
  d.contradictions.forEach(v=>text(v));
  const ids=[];
  for(const entry of d.sources) {
    const s=object(entry,['id','url','title','publisher','event_at','retrieved_at','excerpt','claim','limitation','classification','layer','primary','visibility']);
    for(const k of ['id','url','title','publisher','excerpt','claim','limitation']) text(s[k],k==='excerpt'?2000:1500);
    if(typeof s.id!=='string'||s.id.length>160||!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(s.id))throw new Error('research: invalid source identity');
    const u=new URL(String(s.url)); if(u.protocol!=='https:'||u.username||u.password||u.hash||[...u.searchParams.keys()].some(k=>/token|auth|secret|password|signature|key|code/i.test(k))) throw new Error('research: unsafe source URL');
    if(s.event_at!==null) date(s.event_at); date(s.retrieved_at);
    if(!['observed','inference'].includes(String(s.classification))||!['narrative','revealed'].includes(String(s.layer))||!['public','private'].includes(String(s.visibility))||typeof s.primary!=='boolean') throw new Error('research: invalid source classification');
    // Observed statements must be directly present in the supplied minimal excerpt.
    const normal=(v:unknown)=>String(v).replace(/\s+/g,' ').trim().toLowerCase();
    if(s.classification==='observed'&&!normal(s.excerpt).includes(normal(s.claim))) throw new Error('research: observed claim exceeds supplied excerpt');
    ids.push(s.id);
  }
  if(new Set(ids).size!==ids.length) throw new Error('research: duplicate source');
  return value as {id:string;kind:'research';contact_id:string|null;source_id:string;due_at:string|null;details:ResearchDetails};
}
