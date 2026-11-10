/**
 * The Reader Check's measured check: its predictions against what happened
 * (src/crew/reader.mjs, `calibrate`). The ledger lives in a session's
 * ignored runtime/reader/, never in a dispatch, so a dispatch reports it not
 * measured with that reason. Pure.
 */
import { calibrate } from '../reader.mjs';
import { measured, unknown } from './common.mjs';

export const SPECIALIST = 'reader-check';
export const CHECKS = ['reader.calibration'];
export const NOT_IN_DISPATCH = "the reader ledger is kept in a session's runtime/reader/, not served to a dispatch";

export const measure = ({ readerLedger = null, context = null, at } = {}) => [
  Array.isArray(readerLedger) ? measured('reader.calibration', calibrate(readerLedger, context, at).standing) : unknown('reader.calibration', NOT_IN_DISPATCH)
];
