/**
 * The Guard's measured checks: the directive's constraints breached, and
 * proposals to anyone he marked do not contact or closed, each of which
 * should be zero. Restriction notices are not served yet. Pure.
 */
import { lintRun } from '../lints/guard.mjs';
import { measured, unknown } from './common.mjs';

export const SPECIALIST = 'guard';
export const CHECKS = ['guard.constraint_breaches', 'guard.opt_outs_breached', 'guard.restriction_notices'];
export function measure({ proposals = [], constraints = null, findings = [] }) {
  return [
    constraints ? measured('guard.constraint_breaches', lintRun({ proposals, constraints }).length) : unknown('guard.constraint_breaches', 'the directive carried no constraints'),
    measured('guard.opt_outs_breached', findings.filter(f => f.lint === 'guard.do_not_contact').length),
    unknown('guard.restriction_notices', 'restriction notices are not served yet')
  ];
}
