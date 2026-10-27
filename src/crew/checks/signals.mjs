/** The Signal Scout's measured checks: replies within 7 days to a signal row he carried out, and good meetings on public-signal. Pure. */
import { replies, goodOn } from './common.mjs';

export const SPECIALIST = 'signal-scout';
export const CHECKS = ['signals.replies_7d', 'signals.good_meetings'];
export const measure = input => [replies('signals.replies_7d', input, f => f.row === 'reach_out' && f.features?.topic === 'ai_and_their_job'), goodOn('signals.good_meetings', input, 'public-signal')];
