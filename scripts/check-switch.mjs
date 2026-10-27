/**
 * The old route stays (plan section 8, Phase 5): "The old route stays in code
 * for 30 days after" the switch. Until SWITCHED_ON (src/crew/switch.mjs) is
 * set and 30 days have passed, this refuses any change that removes the
 * shadow route: an unsigned spec, last week's spec carried on, a spec that
 * does not enable the new route, or a readiness not met must each still run
 * in shadow, the crew's default lint line must still say nothing is held,
 * and src/dispatch.mjs must hold a proposal only inside the route's decision.
 * After the 30 days it passes and says the old route may be retired.
 *
 *   node scripts/check-switch.mjs [--today YYYY-MM-DD]
 */
import { oldRouteErrors, oldRouteRemovableFrom, SWITCHED_ON } from '../src/crew/switch.mjs';
import { readFile } from 'node:fs/promises';
import { crewShadow } from '../src/crew/shadow.mjs';

const i = process.argv.indexOf('--today');
const today = i >= 0 ? process.argv[i + 1] : new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
if (!/^\d{4}-\d{2}-\d{2}$/.test(today ?? '')) { console.error('check-switch: --today takes a London date, YYYY-MM-DD.'); process.exit(1); }
// The line the crew writes by default, read from the crew itself, so a change that made it enforce always is caught.
const dispatchSource = await readFile(new URL('../src/dispatch.mjs', import.meta.url), 'utf8');
const errors = oldRouteErrors({ today, shadowLine: crewShadow({ proposals: [], at: `${today}T06:00:00Z` }).lines[0], dispatchSource });
if (errors.length) { console.error(`check-switch: ${errors.join('; ')}.`); process.exitCode = 1; }
else {
  const until = oldRouteRemovableFrom(SWITCHED_ON);
  console.log(SWITCHED_ON === null ? 'PASS: not switched yet; the old route (shadow) is in place.' : today >= until ? `PASS: switched on ${SWITCHED_ON}; its 30 days ended ${until}, so the old route may be retired.` : `PASS: switched on ${SWITCHED_ON}; the old route stays in code until ${until}.`);
}
