/** The Network Steward's measured checks: replies within 7 days, and good meetings on existing-relationship. Pure. */
import { replies, goodOn } from './common.mjs';

export const SPECIALIST = 'network-steward';
export const CHECKS = ['network.replies_7d', 'network.good_meetings'];
export const measure = input => [replies('network.replies_7d', input, f => f.row === 'network'), goodOn('network.good_meetings', input, 'existing-relationship')];
