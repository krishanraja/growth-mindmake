// Prepaid credits (protocol 1.16.0; Ruling, Krish, 2026-10-29): Mindmake's
// share of each prepaid pool placed on it (ElevenLabs, Apify), read from the
// directive only where Control Center's capabilities say `features.credits`.
// Absent means unknown, never a share of zero, and unknown spends nothing.
//
// The runner holds no generator keys, so it spends nothing itself. The daily
// scheduled session does (docs/CREDITS-SESSION.md), reserving and settling
// each spend through the Control Center connector, which takes it off the
// share in the next directive. The guard and `credits_spent` here are for a
// spend this runner itself makes; a session's spend is never reported again.

/** The version that carries `credits_spent` in a report. */
export const CREDITS_VERSION = '1.16.0';
/** The most spends one report carries. */
export const CREDITS_SPENT_MAX = 40;

const POOL = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const num = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;

/**
 * The directive's credits block, or null when it is not served or not there.
 * Only pools that name themselves and a remainder are kept. Pure.
 */
export function readCredits(block, features) {
  if (features?.credits !== true || !block || typeof block !== 'object' || !Array.isArray(block.pools)) return null;
  const pools = block.pools
    .filter(p => p && POOL.test(p.pool ?? '') && typeof p.tool === 'string' && num(p.remaining_for_you) !== null && DAY.test(p.use_by ?? ''))
    .map(p => ({ pool: p.pool, tool: p.tool.slice(0, 60), unit: typeof p.unit === 'string' ? p.unit.slice(0, 20) : 'credits', remaining_for_you: p.remaining_for_you, use_by: p.use_by, days_left: Number.isInteger(p.days_left) ? p.days_left : null }));
  return { pools };
}

/** One activity line for the run: what is left of each pool and when it is wiped, or nothing when unknown. Pure. */
export function creditsLine(credits) {
  if (!credits) return null;
  if (!credits.pools.length) return 'Prepaid credits: none placed on Mindmake this run.';
  const left = credits.pools.map(p => `${p.tool} ${p.unit === 'usd' ? `$${p.remaining_for_you.toFixed(2)}` : `${Math.round(p.remaining_for_you)} ${p.unit}`} left, use by ${p.use_by}`);
  return `Prepaid credits: ${left.join('; ')}. The daily credits session spends them; this run spent none.`;
}

/**
 * A guard over one run's own spending: each spend must fit what is left of
 * its pool's share after this run's earlier ones, and is refused before
 * anything runs when it does not. Unknown credits refuse everything.
 */
export function creditGuard(credits) {
  const spent = [];
  const used = pool => spent.filter(s => s.pool === pool).reduce((sum, s) => sum + s.amount, 0);
  return {
    reserve({ pool, amount, asset, objective_key = null }) {
      if (!credits) return { ok: false, reason: 'credits_unknown' };
      const p = credits.pools.find(c => c.pool === pool);
      if (!p) return { ok: false, reason: 'credits_no_pool' };
      if (!(typeof amount === 'number' && amount > 0 && amount <= 10_000_000) || typeof asset !== 'string' || !asset.trim() || !(objective_key === null || /^[a-z][a-z0-9_]{0,63}$/.test(objective_key))) return { ok: false, reason: 'credits_invalid' };
      if (spent.length >= CREDITS_SPENT_MAX) return { ok: false, reason: 'credits_report_full' };
      if (used(pool) + amount > p.remaining_for_you + 1e-9) return { ok: false, reason: 'credits_over_share' };
      spent.push({ pool, amount, asset: asset.trim().slice(0, 200), objective_key });
      return { ok: true };
    },
    spent: () => spent.map(s => ({ ...s }))
  };
}
