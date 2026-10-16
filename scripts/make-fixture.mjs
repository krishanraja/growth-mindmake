// Generate only synthetic test data. Never use this for live records.
import { mkdir, writeFile } from 'node:fs/promises';
import { APPROVED_CANON } from '../contracts/growth.ts';
const evidence = (n, kind, fact) => ({ id: `${kind}-${n}`, kind, visibility: 'public', fact, url: `https://example.test/research/${n}/${kind}`, observed_at: '2026-10-15T09:00:00Z' });
const contacts = [
  ['10000000-0000-4000-8000-000000000001','Alex Example','Founder','Example Studio','warm'],
  ['10000000-0000-4000-8000-000000000002','Sam Sample','Principal','Sample Practice','cold'],
  ['10000000-0000-4000-8000-000000000003','Jo Synthetic','Director','Synthetic Works','warm'],
  ['10000000-0000-4000-8000-000000000004','Pat Fixture','Founder','Fixture Company','cold']
].map(([id, full_name, title, company, relationship], i) => ({ id, full_name, title, company, relationship, suppressed: i === 2, closed: false, consent_status: relationship === 'cold' ? 'unknown' : 'allowed', offer_fit: i === 1 ? 'revenue_engine' : 'brain', why_fit: 'Illustrative fit: the leader owns a live AI decision. Confirm the need in conversation.', decision_authority: 'unknown', evidence: [evidence(i,'person',`${full_name} is the ${title.toLowerCase()} at ${company}.`),evidence(i,'company',`${company} has described an AI product change.`)], ...(i === 3 ? {} : { buying_moment: evidence(i,'trigger', i === 1 ? 'The company is reviewing pricing for its AI product.' : 'The leader is reviewing how AI can support recurring decisions.') }) }));
const data = { version: 1, generated_at: '2026-10-16T17:00:00Z', source_revision: 'synthetic-fixture-v1', complete: true, canon: APPROVED_CANON, icp: { defined: true, definition: 'Decision-making leaders in a relevant business with a live AI decision.', buyer_titles: ['Founder','Principal','Director'], industries: ['software','advisory'], exclusions: ['student'] }, contacts, deals: [] };
await mkdir(new URL('../fixtures/', import.meta.url), { recursive: true });
await writeFile(new URL('../fixtures/snapshot.json', import.meta.url), JSON.stringify(data, null, 2) + '\n');
