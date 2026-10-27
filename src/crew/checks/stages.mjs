/**
 * The Stages Producer's measured checks: what became of each speaking pitch,
 * and good meetings on guest-seat. A stage counts as confirmed only by a
 * booking Control Center read from a reply with a date or a calendar event
 * (booked_at), never by a form's receipt. Pure.
 */
import { outcomes, goodOn } from './common.mjs';

export const SPECIALIST = 'stages-producer';
export const CHECKS = ['stages.sent', 'stages.replied', 'stages.booked', 'stages.recorded', 'stages.published', 'stages.good_meetings'];
export const measure = input => [...outcomes('stages', input, 'stage'), goodOn('stages.good_meetings', input, 'guest-seat')];
