/** The Visibility Producer's measured checks: what became of each podcast pitch (1.9.0, read for the first time, N05), and good meetings on podcast. Pure. */
import { outcomes, goodOn } from './common.mjs';

export const SPECIALIST = 'visibility-producer';
export const CHECKS = ['visibility.sent', 'visibility.replied', 'visibility.booked', 'visibility.recorded', 'visibility.published', 'visibility.good_meetings'];
export const measure = input => [...outcomes('visibility', input, 'podcast'), goodOn('visibility.good_meetings', input, 'podcast')];
