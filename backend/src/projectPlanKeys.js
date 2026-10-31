// The Sl. No of every row in the locked project plan (frontend
// src/data/projectPlan.js): the three groups and their nine activities each.
// A frontend test compares this list with the plan so the two cannot drift.
export const PROJECT_PLAN_WEEKS = 65;

export const PROJECT_PLAN_KEYS = ["1", "2", "3"].flatMap((group) => [
  `${group}.0`,
  ...["a", "b", "c", "d", "e", "f", "g", "h", "i"].map((item) => `${group}${item}`),
]);
