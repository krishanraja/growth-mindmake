/** The Multiplier Steward's measured checks: connector replies within 7 days, and good meetings on multiplier-intro. Pure. */
import { replies, goodOn } from './common.mjs';

export const SPECIALIST = 'multiplier-steward';
export const CHECKS = ['multiplier.replies_7d', 'multiplier.good_meetings'];
export const measure = input => [replies('multiplier.replies_7d', input, f => f.row === 'partners' || (f.row === 'reach_out' && f.amplifier_kind === 'connector')), goodOn('multiplier.good_meetings', input, 'multiplier-intro')];
