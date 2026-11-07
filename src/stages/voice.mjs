/**
 * The voice check on every email this run prepares in Krish's name or in Jonny's box in his style
 * (Ruling, Krish, 2026-11-07: everything sent from his email, and Jonny's emails in his style, sounds like him).
 *
 * Control Center owns the one voice check (its api/_voiceCheck.ts, reading krish-voice's kill list in
 * ai-harness); this engine asks it through `POST voice-check` (features.voice_check) and keeps no list of its
 * own. An email whose words break a hard rule is held here, before it is proposed, so it never reaches his
 * list or Jonny's drafts. A Control Center that does not serve the check, or a check that cannot be read, holds
 * nothing and says so: Control Center checks again before anything lands.
 */

/** The proposals whose email words break a hard krish-voice rule, and why. Pure apart from the check it is given. */
export async function voiceHolds({ cc, capabilities, proposals }) {
  const held = new Map();
  if (capabilities?.features?.voice_check !== true || typeof cc?.voiceCheck !== 'function') return { held, checked: 0, unread: 0, served: false };
  let checked = 0, unread = 0;
  for (const p of proposals) {
    let a;
    try { a = JSON.parse(p.exact_payload ?? 'null'); } catch { continue; }
    if (!a || a.channel !== 'email' || typeof a.body !== 'string' || !a.body.trim()) continue;
    const channel = a.mailbox === 'jonny' ? 'email_jonny' : 'email';
    let result;
    try { result = await cc.voiceCheck({ text: a.body, channel, ...(typeof a.subject === 'string' && a.subject ? { subject: a.subject } : {}) }); }
    catch { unread++; continue; }
    checked++;
    const hard = Array.isArray(result?.hard) ? result.hard : [];
    if (hard.length) held.set(p.proposal_id, [...new Set(hard.map(h => String(h?.rule ?? 'rule')))]);
  }
  return { held, checked, unread, served: true };
}

/** The hold line for a run, rule names only: never the words, a name or an address (this repository is public). */
export function voiceHoldLine(held) {
  const rules = [...new Set([...held.values()].flat())].sort();
  return { reason: 'voice_refused', detail: `${held.size} email${held.size === 1 ? '' : 's'} held: the words broke Krish's voice rules (${rules.join(', ').replace(/_/g, ' ')}).` };
}
