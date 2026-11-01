// Booked-forward figures for the Forecast tab. Nothing here guesses: a seat is
// filled in a month only if a deployment you entered covers that month's
// reference day, by the Control Center rule (today for the current month, the
// first day for any other).
import { labelOf, monthLabel, percent } from './analyticsData';

export const HOURS_PER_PERSON = 160;
const COUNTED = new Set(['Consultant', 'Lead Consultant']);

export const referenceDayOf = (month, today) => (today.slice(0, 7) === month ? today : `${month}-01`);

const toUtc = (isoDate) => {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};
const iso = (date) => date.toISOString().slice(0, 10);

export function addDays(isoDate, days) {
  const date = toUtc(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}

// Moves a date forward by whole months. 31 January plus one month is the last
// day of February, never a date that rolls into March.
export function addMonthsToDate(isoDate, months) {
  const date = toUtc(isoDate);
  const targetIndex = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(targetIndex / 12);
  const month = targetIndex % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return iso(new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay))));
}

// Hours allocated on `day`: each seat gives its occupants' share of 160, and a
// seat never exceeds one person's hours.
export function allocatedHoursOn(deployments, day) {
  const bySeat = new Map();
  for (const d of deployments) {
    if (d.start <= day && d.end >= day) bySeat.set(d.positionCode, (bySeat.get(d.positionCode) ?? 0) + (HOURS_PER_PERSON * d.allocationPercentage) / 100);
  }
  return [...bySeat.values()].reduce((sum, hours) => sum + Math.min(HOURS_PER_PERSON, hours), 0);
}

// Pushes the end of every deployment that ends from today to `withinDays` days
// away out by `months`. Deployments that ended already stay ended.
export function extendDeployments(deployments, today, { withinDays, months }) {
  if (months === 0) return deployments;
  const limit = addDays(today, withinDays);
  return deployments.map((d) => (d.end >= today && d.end <= limit ? { ...d, end: addMonthsToDate(d.end, months) } : d));
}

export const isSeatDeployment = (deployment) => COUNTED.has(deployment.positionName);

// Allocation percentage for each month if the given deployments ran as listed.
export function allocationByMonth(seatRows, deployments, months, today) {
  return months.map((month) => {
    const available = seatRows.filter((seat) => seat.month === month).reduce((sum, seat) => sum + seat.availableHours, 0);
    return { month, label: monthLabel(month), available, allocated: allocatedHoursOn(deployments, referenceDayOf(month, today)) };
  }).map((entry) => ({ ...entry, percent: percent(entry.allocated, entry.available) }));
}

// One value per month, for every value of `field` (or one line for all rows).
export function monthlySeries(rows, months, field, valueOf) {
  const names = field === null ? ['All seats'] : [...new Set(rows.map((row) => labelOf(row[field])))].sort();
  const data = months.map((month) => {
    const inMonth = rows.filter((row) => row.month === month);
    return {
      month,
      label: monthLabel(month),
      ...Object.fromEntries(names.map((name) => [name, valueOf(field === null ? inMonth : inMonth.filter((row) => labelOf(row[field]) === name))])),
    };
  });
  return { names, data };
}

const sumOf = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
export const allocationPercentOf = (rows) => (sumOf(rows, 'availableHours') === 0 ? null : percent(sumOf(rows, 'allocatedHours'), sumOf(rows, 'availableHours')));
export const utilizationPercentOf = (rows) => (sumOf(rows, 'allocatedHours') === 0 ? null : percent(sumOf(rows, 'utilizedHours'), sumOf(rows, 'allocatedHours')));
