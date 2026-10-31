// The project plan, transcribed from the owner's plan sheet. LOCKED: never
// change a word, a status, a week or a percentage here on your own. Any change
// needs the owner's explicit, repeated confirmation, and the locked copy in
// projectPlan.lock.test.js must be updated in the same change
// (.claude/rules/project-plan.md). Spellings are exactly as on the sheet,
// including "Measruing".
//
// Weeks are the sheet's own week numbers (Week 1 to Week 65); the sheet gives
// months but no calendar dates. `startWeek`/`endWeek` are the first and last
// shaded week of the activity's bar on the sheet. `poc` is the sheet's
// percentage-complete column.

export const STATUS = Object.freeze({
  COMPLETED: 'Completed',
  IN_PROGRESS: 'In Progress',
  YET_TO_START: 'Yet to Start',
});

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const activity = (slNo, text, status, startWeek, endWeek, poc) => ({
  slNo,
  category: '',
  activity: text,
  status,
  startWeek,
  endWeek,
  poc,
});

export const PLAN_MONTHS = deepFreeze([
  { label: 'July', firstWeek: 1, lastWeek: 4 },
  { label: 'August', firstWeek: 5, lastWeek: 8 },
  { label: 'September', firstWeek: 9, lastWeek: 13 },
  { label: 'October', firstWeek: 14, lastWeek: 17 },
  { label: 'November', firstWeek: 18, lastWeek: 21 },
  { label: 'December', firstWeek: 22, lastWeek: 26 },
  { label: 'January', firstWeek: 27, lastWeek: 30 },
  { label: 'February', firstWeek: 31, lastWeek: 34 },
  { label: 'March', firstWeek: 35, lastWeek: 39 },
  { label: 'April', firstWeek: 40, lastWeek: 43 },
  { label: 'May', firstWeek: 44, lastWeek: 47 },
  { label: 'June', firstWeek: 48, lastWeek: 52 },
  { label: 'July', firstWeek: 53, lastWeek: 56 },
  { label: 'Aug', firstWeek: 57, lastWeek: 60 },
  { label: 'Sep', firstWeek: 61, lastWeek: 65 },
]);

export const PLAN_WEEK_COUNT = 65;

export const PLAN_OWNER = deepFreeze({ label: 'BU / Operations / Sales Director', poc: 6 });

export const PLAN_GROUPS = deepFreeze([
  {
    slNo: '1.0',
    category: '',
    activity: 'Onshore Enabled Factory Delivery - Development & Enhancement Projects',
    status: STATUS.IN_PROGRESS,
    startWeek: 1,
    endWeek: 39,
    poc: 18,
    items: [
      activity('a', 'Identify resources for the ODC from the existing account pools', STATUS.COMPLETED, 1, 4, 100),
      activity('b', 'Split the projects into workstreams', STATUS.COMPLETED, 5, 6, 100),
      activity('c', 'Split people into small teams per workstream and appoint a lead for each team', STATUS.COMPLETED, 7, 8, 100),
      activity('d', 'Set up zero trust network connectivity & test VPN rerouting from KSA to India', STATUS.COMPLETED, 3, 6, 100),
      activity('e', 'Adopt the existing projects and run them under the revised structure', STATUS.IN_PROGRESS, 9, 21, 0),
      activity('f', 'Implement a KPI-driven governance framework for Measruing Utilization', STATUS.YET_TO_START, 18, 23, 0),
      activity('g', 'Establish SOP Document', STATUS.YET_TO_START, 22, 26, 0),
      activity('h', 'Pilot two projects from other BUs, or verticals to test if the model holds', STATUS.YET_TO_START, 27, 39, 0),
      activity('i', 'Submit Rollout Strategy Document for all MENA projects', STATUS.YET_TO_START, 35, 39, 0),
    ],
  },
  {
    slNo: '2.0',
    category: '',
    activity: 'Onshore Enabled Factory Delivery - SAP Implementation & Rollout Projects',
    status: STATUS.IN_PROGRESS,
    startWeek: 14,
    endWeek: 52,
    poc: 0,
    items: [
      activity('a', 'Identify resources for the ODC from the existing account pools', STATUS.IN_PROGRESS, 14, 17, 0),
      activity('b', 'Split the projects into workstreams', STATUS.YET_TO_START, 18, 19, 0),
      activity('c', 'Split people into small teams per workstream and appoint a lead for each team', STATUS.YET_TO_START, 20, 21, 0),
      activity('d', 'Set up zero trust network connectivity & test VPN rerouting from KSA to India', STATUS.YET_TO_START, 16, 19, 0),
      activity('e', 'Adopt the existing projects and run them under the revised structure', STATUS.YET_TO_START, 22, 34, 0),
      activity('f', 'Implement a KPI-driven governance framework for Measruing Utilization', STATUS.YET_TO_START, 31, 36, 0),
      activity('g', 'Establish SOP Document', STATUS.YET_TO_START, 35, 39, 0),
      activity('h', 'Pilot two projects from other BUs, or verticals to test if the model holds', STATUS.YET_TO_START, 40, 52, 0),
      activity('i', 'Submit Rollout Strategy Document for all MENA projects', STATUS.YET_TO_START, 48, 52, 0),
    ],
  },
  {
    slNo: '3.0',
    category: '',
    activity: 'Onshore Enabled Factory Delivery - Managed Services Project',
    status: STATUS.YET_TO_START,
    startWeek: 27,
    endWeek: 65,
    poc: 0,
    items: [
      activity('a', 'Identify resources for the ODC from the existing account pools', STATUS.YET_TO_START, 27, 30, 0),
      activity('b', 'Split the projects into workstreams', STATUS.YET_TO_START, 31, 32, 0),
      activity('c', 'Split people into small teams per workstream and appoint a lead for each team', STATUS.YET_TO_START, 33, 34, 0),
      activity('d', 'Set up zero trust network connectivity & test VPN rerouting from KSA to India', STATUS.YET_TO_START, 29, 32, 0),
      activity('e', 'Adopt the existing projects and run them under the revised structure', STATUS.YET_TO_START, 35, 47, 0),
      activity('f', 'Implement a KPI-driven governance framework for Measruing Utilization', STATUS.YET_TO_START, 44, 49, 0),
      activity('g', 'Establish SOP Document', STATUS.YET_TO_START, 48, 52, 0),
      activity('h', 'Pilot two projects from other BUs, or verticals to test if the model holds', STATUS.YET_TO_START, 53, 65, 0),
      activity('i', 'Submit Rollout Strategy Document for all MENA projects', STATUS.YET_TO_START, 61, 65, 0),
    ],
  },
]);
