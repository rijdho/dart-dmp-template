// What this page adds to a new plan: the contact's affiliation, recorded as IT:U with its ROR
// ID. A plan opened from a file keeps whatever affiliation it carries.

import { createPlan, editable } from './plan.js?v=21';

export const ITU_AFFILIATION = Object.freeze({
  name: 'IT:U Interdisciplinary Transformation University Austria',
  affiliation_id: Object.freeze({ identifier: 'https://ror.org/03jzk4720', type: 'ror' }),
});

/** A new, editable plan whose contact is affiliated with IT:U. */
export function createItuPlan(options) {
  const plan = editable(createPlan(options));
  plan.dmp.contact.affiliation = [structuredClone(ITU_AFFILIATION)];
  return plan;
}
