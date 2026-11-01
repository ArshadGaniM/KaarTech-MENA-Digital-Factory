// The Sl. No of every row in the locked initiative plan (frontend
// src/data/initiativePlan.js): the three groups and their nine activities each.
// A frontend test compares this list with the plan so the two cannot drift.
export const INITIATIVE_PLAN_WEEKS = 65;

export const INITIATIVE_PLAN_KEYS = ["1", "2", "3"].flatMap((group) => [
  `${group}.0`,
  ...["a", "b", "c", "d", "e", "f", "g", "h", "i"].map((item) => `${group}${item}`),
]);
