// Pure helpers behind the analytics charts. They take plain rows and return
// plain rows, so every chart can be checked without drawing anything.

export const NOT_SET = 'Not set';

export const labelOf = (value) => (value === null || value === undefined || value === '' ? NOT_SET : String(value));

// Rows where every set filter matches. A filter is { field: value | null }.
export function applyFilters(rows, filters) {
  const active = Object.entries(filters).filter(([, value]) => value !== null && value !== undefined);
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every(([field, value]) => labelOf(row[field]) === value));
}

// Rows narrowed by every filter except `field`, so a chart keeps showing all
// of its own slices and the user can switch between them.
export const applyFiltersExcept = (rows, filters, field) => applyFilters(rows, { ...filters, [field]: null });

export function countBy(rows, field) {
  const counts = new Map();
  for (const row of rows) {
    const key = labelOf(row[field]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

// Counts of values inside a list field such as skills, one count per person.
export function countListBy(rows, field) {
  const counts = new Map();
  for (const row of rows) {
    for (const key of new Set(row[field] ?? [])) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

// The first `limit` entries, with the rest added up as one "Other" entry.
export function topWithOther(entries, limit) {
  if (entries.length <= limit) return entries;
  const rest = entries.slice(limit).reduce((sum, entry) => sum + entry.value, 0);
  return [...entries.slice(0, limit), { name: 'Other', value: rest }];
}

// full: exactly 100. partial: above 0 and below 100. none: no deployment today.
// over: above 100, which the allocation rule should make impossible.
export function allocationBucket(allocation) {
  if (!allocation) return 'none';
  if (allocation > 100) return 'over';
  return allocation === 100 ? 'full' : 'partial';
}

export const BUCKET_LABELS = { full: 'Fully allocated', partial: 'Partly allocated', none: 'Not deployed', over: 'Over-allocated' };

// Equal-width bands of `width`, from the band holding the smallest value to the
// one holding the largest. Empty bands in between stay, so gaps are visible.
export function histogram(values, width) {
  const numbers = values.filter((value) => Number.isFinite(value));
  if (numbers.length === 0 || !(width > 0)) return [];
  const first = Math.floor(Math.min(...numbers) / width);
  const last = Math.floor(Math.max(...numbers) / width);
  const bands = Array.from({ length: last - first + 1 }, (_, i) => {
    const from = (first + i) * width;
    return { from, to: from + width, label: `${from}-${from + width}`, value: 0 };
  });
  for (const number of numbers) bands[Math.floor(number / width) - first].value += 1;
  return bands;
}

// Bands of a percentage that include their upper end, so exactly 100 sits in
// the top band (76-100) and not in the one above. Zero gets a band of its own
// when `includeZero` is set.
export function percentBands(values, width, includeZero) {
  const numbers = values.filter((value) => Number.isFinite(value));
  const positive = numbers.filter((value) => value > 0);
  const last = positive.length === 0 ? -1 : Math.ceil(Math.max(...positive) / width) - 1;
  const bands = Array.from({ length: last + 1 }, (_, i) => ({ label: `${i * width + 1}-${(i + 1) * width}`, value: 0 }));
  for (const value of positive) bands[Math.ceil(value / width) - 1].value += 1;
  const zeros = numbers.length - positive.length;
  return includeZero && zeros > 0 ? [{ label: '0', value: zeros }, ...bands] : bands;
}

// Counts for each pair of values, limited to the biggest rows and columns.
export function crossTab(rows, rowField, colField, rowLimit, colLimit) {
  const rowNames = countBy(rows, rowField).slice(0, rowLimit).map((entry) => entry.name);
  const colNames = countBy(rows, colField).slice(0, colLimit).map((entry) => entry.name);
  const cells = new Map();
  for (const row of rows) {
    const key = `${labelOf(row[rowField])}\u0000${labelOf(row[colField])}`;
    cells.set(key, (cells.get(key) ?? 0) + 1);
  }
  return {
    rowNames,
    colNames,
    cell: (rowName, colName) => cells.get(`${rowName}\u0000${colName}`) ?? 0,
  };
}

export const average = (values) => {
  const numbers = values.filter((value) => Number.isFinite(value));
  return numbers.length === 0 ? null : numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
};

export const percent = (part, whole) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (month) => `${MONTH_NAMES[Number(month.slice(5)) - 1]} ${month.slice(2, 4)}`;

// Sums of the seat hours per value of `field`.
export function seatTotalsBy(seats, field) {
  const groups = new Map();
  for (const seat of seats) {
    const key = labelOf(seat[field]);
    const entry = groups.get(key) ?? { name: key, seats: 0, filled: 0, available: 0, allocated: 0, utilized: 0 };
    entry.seats += 1;
    entry.filled += seat.filled ? 1 : 0;
    entry.available += seat.availableHours;
    entry.allocated += seat.allocatedHours;
    entry.utilized += seat.utilizedHours;
    groups.set(key, entry);
  }
  return [...groups.values()].map((entry) => ({
    ...entry,
    vacantSeats: entry.seats - entry.filled,
    vacant: entry.available - entry.allocated,
    allocationPercent: percent(entry.allocated, entry.available),
    utilizationPercent: percent(entry.utilized, entry.allocated),
    fillPercent: percent(entry.filled, entry.seats),
  }));
}

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  // A leading = + - @ makes a spreadsheet run the cell as a formula.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export const toCsv = (columns, rows) => [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');

// Totals per month, in month order, for the seats rows given.
export const seatsByMonth = (seats) =>
  seatTotalsBy(seats, 'month')
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name, ...totals }) => ({ month: name, ...totals }));

// Department, team and seat type as a tree for the rings chart. The chart sizes
// every ring from `value`, so each parent carries the sum of its children.
// Leaf names include the team, because the chart keys its arcs by name. Seats
// with no hours for the metric are left out. `fillOf(index)` colours a
// department and everything under it.
export function seatTree(seats, metric, fillOf) {
  const amountOf = (seat) => (metric === 'allocated' ? seat.allocatedHours : metric === 'available' ? seat.availableHours : seat.availableHours - seat.allocatedHours);
  const departments = new Map();
  for (const seat of seats) {
    const amount = amountOf(seat);
    if (amount <= 0) continue;
    const teams = departments.get(labelOf(seat.departmentName)) ?? new Map();
    const kinds = teams.get(seat.team) ?? new Map();
    kinds.set(seat.positionName, (kinds.get(seat.positionName) ?? 0) + amount);
    teams.set(seat.team, kinds);
    departments.set(labelOf(seat.departmentName), teams);
  }
  const withTotal = (name, children, fill) => ({ name, children, fill, value: Math.round(children.reduce((sum, child) => sum + child.value, 0) * 10) / 10 });
  return withTotal(
    'All departments',
    [...departments].map(([name, teams], index) => {
      const fill = fillOf(index);
      return withTotal(
        name,
        [...teams].map(([team, kinds]) =>
          withTotal(team, [...kinds].map(([kind, amount]) => ({ name: `${kind} (${team})`, kind, fill, value: Math.round(amount * 10) / 10 })), fill)
        ),
        fill
      );
    })
  );
}
