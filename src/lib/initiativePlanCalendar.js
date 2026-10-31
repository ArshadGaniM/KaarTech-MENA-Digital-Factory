import { PLAN_START_DATE, STATUS } from '../data/initiativePlan';

// Calendar maths for the locked initiative plan. Week 1 begins on PLAN_START_DATE
// and every week is 7 days. All dates are treated as UTC calendar days so the
// viewer's time zone can never move a week.

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const [START_YEAR, START_MONTH, START_DAY] = PLAN_START_DATE.split('-').map(Number);
const START_MS = Date.UTC(START_YEAR, START_MONTH - 1, START_DAY);

export function weekStart(week) {
  return new Date(START_MS + (week - 1) * WEEK_MS);
}

export function weekEnd(week) {
  return new Date(START_MS + (week - 1) * WEEK_MS + 6 * DAY_MS);
}

const format = (date, options) => date.toLocaleDateString('en-GB', { timeZone: 'UTC', ...options });

// "1 Jul"
export function shortDate(date) {
  return format(date, { day: 'numeric', month: 'short' });
}

// "1 Jul 2026 to 7 Jul 2026"
export function weekRangeLabel(week) {
  const long = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${format(weekStart(week), long)} to ${format(weekEnd(week), long)}`;
}

// The plan week a date falls in: 1 or more once the plan has started, 0 or
// less before it. `date` is read in the viewer's own calendar day.
export function weekOf(date) {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((day - START_MS) / WEEK_MS) + 1;
}

// The percentage to judge a row by: the recorded actual if there is one,
// otherwise the plan sheet's own figure.
export function effectivePoc(row, actual) {
  return actual ? actual.actualPoc : row.poc;
}

// Behind plan: the planned end week has passed and the work is not 100% done,
// or the planned start week has passed and nothing has started (the sheet says
// "Yet to Start" and no actual start is recorded).
export function isBehindPlan(row, actual, currentWeek) {
  if (currentWeek < 1) return false;
  const started = (actual && actual.actualStartWeek != null) || row.status !== STATUS.YET_TO_START;
  const overdue = currentWeek > row.endWeek && effectivePoc(row, actual) < 100;
  const notStarted = currentWeek > row.startWeek && !started;
  return overdue || notStarted;
}
