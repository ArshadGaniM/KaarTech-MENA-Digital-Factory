import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useAnalyticsSeats } from '../../hooks/useAnalyticsData';
import {
  BUCKET_LABELS,
  addMonths,
  allocationBucket as allocationBucketOf,
  applyFilters,
  applyFiltersExcept,
  countBy,
  currentMonth,
  percentBands,
  labelOf,
  monthLabel,
  percent,
  seatTotalsBy,
  seatsByMonth,
  topWithOther,
} from '../../lib/analyticsData';
import { formatCount } from '../../lib/formatCount';
import ChartCard from './ChartCard';
import ControlSelect from './Controls';
import SlicerBar from './SlicerBar';
import { colorAt } from './palette';
import { BarsChart, DonutPie, SunburstView, TrendChart } from './charts';
import styles from './Analytics.module.css';

const BUCKET_ORDER = ['full', 'partial', 'none', 'over'];
const BUCKET_COLORS = {
  [BUCKET_LABELS.full]: 'var(--color-allocation-full)',
  [BUCKET_LABELS.partial]: 'var(--color-allocation-partial)',
  [BUCKET_LABELS.none]: 'var(--color-allocation-none)',
  [BUCKET_LABELS.over]: 'var(--color-allocation-over)',
};
const TOP_OPTIONS = ['5', '10', '15', '20'];
const SEAT_SLICERS = [
  { field: 'departmentName', label: 'Department' },
  { field: 'teamName', label: 'Team' },
  { field: 'practiceName', label: 'Practice' },
  { field: 'positionName', label: 'Seat type' },
];
const NO_ROWS = [];
const NO_SEAT_FILTERS = { departmentName: null, teamName: null, practiceName: null, positionName: null };
const MONTH_CHOICES = Array.from({ length: 24 }, (_, i) => i - 11);
const monthOptionsFrom = (base) => MONTH_CHOICES.map((offset) => ({ value: addMonths(base, offset), label: monthLabel(addMonths(base, offset)) }));
const hours = (value) => Math.round(value);

const clamp = (month, from, to) => (month < from ? from : month > to ? to : month);

// The allocation visuals. People charts follow the people slicers, which the
// page owns. Seat and hour charts follow the seat slicers and the month range
// kept here, because the range decides which months are fetched.
function AllocationTab({ people, filters, onToggle, refreshKey }) {
  const base = currentMonth();
  const [from, setFrom] = useState(addMonths(base, -2));
  const [to, setTo] = useState(addMonths(base, 6));
  const [focusChoice, setFocusChoice] = useState(base);
  const [seatFilters, setSeatFilters] = useState(NO_SEAT_FILTERS);
  const [retries, setRetries] = useState(0);
  const seatsResult = useAnalyticsSeats(from, to, refreshKey + retries);

  const focus = clamp(focusChoice, from, to);
  const monthOptions = useMemo(() => monthOptionsFrom(base), [base]);
  const setSeat = (field, value) => setSeatFilters((current) => ({ ...current, [field]: value }));
  const toggleSeat = (field, value) => setSeat(field, seatFilters[field] === value ? null : value);

  // Local slicers of the individual charts.
  const [bucketTop, setBucketTop] = useState('10');
  const [tileMetric, setTileMetric] = useState('allocationPercent');
  const [tileTop, setTileTop] = useState('24');
  const [deptMetric, setDeptMetric] = useState('allocationPercent');
  const [fillSeat, setFillSeat] = useState('all');
  const [vacantBy, setVacantBy] = useState('teamName');
  const [vacantTop, setVacantTop] = useState('10');
  const [listMode, setListMode] = useState('none');
  const [listTop, setListTop] = useState('10');
  const [monthMode, setMonthMode] = useState('hours');
  const [lineBy, setLineBy] = useState('total');
  const [lineMetric, setLineMetric] = useState('utilizationPercent');
  const [benchBy, setBenchBy] = useState('positionName');
  const [bandWidth, setBandWidth] = useState('25');
  const [bandNone, setBandNone] = useState('no');
  const [sunMetric, setSunMetric] = useState('allocated');

  const peopleRows = applyFilters(people, filters);
  const exceptPeople = (field) => applyFiltersExcept(people, filters, field);

  const seats = seatsResult.data?.rows ?? NO_ROWS;
  const seatRows = useMemo(() => applyFilters(seats, seatFilters), [seats, seatFilters]);
  const focusSeats = seatRows.filter((seat) => seat.month === focus);
  const months = seatsByMonth(seatRows).map((entry) => ({ ...entry, label: monthLabel(entry.month) }));
  const seatSlicers = SEAT_SLICERS.map((slicer) => ({ ...slicer, values: [...new Set(seats.map((seat) => labelOf(seat[slicer.field])))].sort() }));

  // 11 and 12: how fully the people are deployed.
  const bucketData = countBy(exceptPeople('allocationBucket'), 'allocationBucket').sort((a, b) => BUCKET_ORDER.indexOf(keyOfLabel(a.name)) - BUCKET_ORDER.indexOf(keyOfLabel(b.name)));
  const positionNames = topWithOther(countBy(exceptPeople('position'), 'position'), Number(bucketTop)).filter((entry) => entry.name !== 'Other').map((entry) => entry.name);
  const stacked = positionNames.map((name) => {
    const inPosition = exceptPeople('position').filter((row) => labelOf(row.position) === name);
    return { name, ...Object.fromEntries(BUCKET_ORDER.map((key) => [BUCKET_LABELS[key], inPosition.filter((row) => allocationBucketOf(row.allocation) === key).length])) };
  });

  // 13 and 14: how fully teams and departments are allocated in the focus month.
  const metricLabels = { allocationPercent: 'Allocated %', utilizationPercent: 'Utilized %', vacantSeats: 'Vacant seats', vacant: 'Vacant hours' };
  const teamTiles = seatTotalsBy(focusSeats, 'teamName').sort((a, b) => b[tileMetric] - a[tileMetric] || a.name.localeCompare(b.name)).slice(0, Number(tileTop));
  const departments = seatTotalsBy(focusSeats, 'departmentName').sort((a, b) => b[deptMetric] - a[deptMetric] || a.name.localeCompare(b.name));

  // 15 and 16: seat fill and vacant seats.
  const fillSeats = focusSeats.filter((seat) => fillSeat === 'all' || seat.positionName === fillSeat);
  const fillRates = seatTotalsBy(fillSeats, 'departmentName').sort((a, b) => b.fillPercent - a.fillPercent || a.name.localeCompare(b.name));
  const vacant = seatTotalsBy(focusSeats, vacantBy).filter((entry) => entry.vacantSeats > 0).sort((a, b) => b.vacantSeats - a.vacantSeats || a.name.localeCompare(b.name)).slice(0, Number(vacantTop));

  // 17: people to look at.
  const listed = (() => {
    const wanted = peopleRows.filter((row) => allocationBucketOf(row.allocation) === listMode);
    const sorted = listMode === 'none' ? [...wanted].sort((a, b) => b.totalExperience - a.totalExperience) : [...wanted].sort((a, b) => a.allocation - b.allocation);
    return sorted.slice(0, Number(listTop));
  })();

  // 19: one line per group.
  const lineGroups = lineBy === 'total' ? ['All seats'] : countBy(seatRows, lineBy === 'department' ? 'departmentName' : 'practiceName').slice(0, 5).map((entry) => entry.name);
  const lineData = (() => {
    const field = lineBy === 'department' ? 'departmentName' : 'practiceName';
    const byMonth = new Map();
    for (const seat of seatRows) {
      const group = lineBy === 'total' ? 'All seats' : labelOf(seat[field]);
      if (!lineGroups.includes(group)) continue;
      const key = `${seat.month}\u0000${group}`;
      const entry = byMonth.get(key) ?? { month: seat.month, group, available: 0, allocated: 0, utilized: 0 };
      entry.available += seat.availableHours;
      entry.allocated += seat.allocatedHours;
      entry.utilized += seat.utilizedHours;
      byMonth.set(key, entry);
    }
    return [...new Set(seatRows.map((seat) => seat.month))].sort().map((month) => ({
      month,
      label: monthLabel(month),
      ...Object.fromEntries(
        lineGroups.map((group) => {
          const entry = byMonth.get(`${month}\u0000${group}`) ?? { available: 0, allocated: 0, utilized: 0 };
          return [group, lineMetric === 'allocationPercent' ? percent(entry.allocated, entry.available) : percent(entry.utilized, entry.allocated)];
        })
      ),
    }));
  })();

  // 20: vacant hours by month, stacked.
  const benchNames = countBy(seatRows, benchBy).slice(0, 6).map((entry) => entry.name);
  const benchData = [...new Set(seatRows.map((seat) => seat.month))].sort().map((month) => ({
    month,
    label: monthLabel(month),
    ...Object.fromEntries(benchNames.map((name) => [name, hours(seatRows.filter((seat) => seat.month === month && labelOf(seat[benchBy]) === name).reduce((sum, seat) => sum + seat.availableHours - seat.allocatedHours, 0))])),
  }));

  // 21: how allocation is spread.
  const bands = percentBands(
    peopleRows.map((row) => row.allocation),
    Number(bandWidth),
    bandNone === 'yes'
  );

  // 22: department, team and seat type as rings.
  const sunTree = (() => {
    const value = (seat) => (sunMetric === 'allocated' ? seat.allocatedHours : sunMetric === 'available' ? seat.availableHours : seat.availableHours - seat.allocatedHours);
    const departmentsTree = new Map();
    for (const seat of focusSeats) {
      const amount = value(seat);
      if (amount <= 0) continue;
      const dept = labelOf(seat.departmentName);
      const teams = departmentsTree.get(dept) ?? new Map();
      const seatsInTeam = teams.get(seat.teamName) ?? new Map();
      seatsInTeam.set(seat.positionName, (seatsInTeam.get(seat.positionName) ?? 0) + amount);
      teams.set(seat.teamName, seatsInTeam);
      departmentsTree.set(dept, teams);
    }
    // The chart sizes every ring from `value`, so each parent carries the sum of its children.
    const withTotal = (name, children, fill) => ({ name, children, fill, value: children.reduce((sum, child) => sum + child.value, 0) });
    return withTotal(
      'All departments',
      [...departmentsTree].map(([name, teams], index) => {
        const fill = colorAt(index);
        return withTotal(
          name,
          [...teams].map(([teamName, kinds]) =>
            withTotal(teamName, [...kinds].map(([kind, amount]) => ({ name: `${kind} (${teamName})`, kind, fill, value: hours(amount) })), fill)
          ),
          fill
        );
      })
    );
  })();
  const sunRows = sunTree.children.flatMap((dept) => dept.children.flatMap((team) => team.children.map((kind) => [dept.name, team.name, kind.kind, kind.value])));

  const focusTotals = seatsByMonth(focusSeats)[0];

  const monthSlicers = (
    <>
      <ControlSelect label="From month" value={from} options={monthOptions} onChange={(value) => { setFrom(value); if (value > to) setTo(value); }} />
      <ControlSelect label="To month" value={to} options={monthOptions} onChange={(value) => { setTo(value); if (value < from) setFrom(value); }} />
      <ControlSelect label="Focus month" value={focus} options={monthOptions.filter((option) => option.value >= from && option.value <= to)} onChange={setFocusChoice} />
    </>
  );

  return (
    <div className={styles.page}>
      <SlicerBar
        slicers={seatSlicers}
        filters={seatFilters}
        onChange={setSeat}
        onReset={() => setSeatFilters(NO_SEAT_FILTERS)}
        matching={seatsResult.error && !seatsResult.data ? 'Seat data unavailable' : `${formatCount(focusSeats.length)} seats in ${monthLabel(focus)}`}
      >
        {monthSlicers}
      </SlicerBar>
      {seatsResult.error && (
        <p className={styles.error} role="alert">
          Could not load seat hours: {seatsResult.error.message}{' '}
          <button type="button" className={styles.linkButton} onClick={() => setRetries((count) => count + 1)}>
            Try again
          </button>
        </p>
      )}

      <div className={styles.grid}>
        <ChartCard
          title="Allocation of people"
          columns={['Allocation', 'People']}
          rows={bucketData.map((entry) => [entry.name, entry.value])}
        >
          <DonutPie
            data={bucketData}
            colors={BUCKET_COLORS}
            activeName={filters.allocationBucket ?? null}
            onPick={(name) => onToggle('allocationBucket', name)}
            total={formatCount(exceptPeople('allocationBucket').length)}
            centerLabel="people"
          />
        </ChartCard>

        <ChartCard
          title="Allocation by employee position"
          columns={['Position', ...BUCKET_ORDER.map((key) => BUCKET_LABELS[key])]}
          rows={stacked.map((entry) => [entry.name, ...BUCKET_ORDER.map((key) => entry[BUCKET_LABELS[key]])])}
          controls={<ControlSelect label="Show top positions" value={bucketTop} options={TOP_OPTIONS} onChange={setBucketTop} />}
        >
          <BarsChart sideways stacked data={stacked} series={BUCKET_ORDER.map((key) => ({ key: BUCKET_LABELS[key], label: BUCKET_LABELS[key], color: BUCKET_COLORS[BUCKET_LABELS[key]] }))} onPick={(name) => onToggle('position', name)} />
        </ChartCard>

        <ChartCard
          wide
          title={`Team allocation in ${monthLabel(focus)}`}
          summary={focusTotals ? `${percent(focusTotals.allocated, focusTotals.available)}% of ${formatCount(hours(focusTotals.available))} available hours are allocated.` : undefined}
          columns={['Team', metricLabels[tileMetric]]}
          rows={teamTiles.map((entry) => [entry.name, entry[tileMetric]])}
          controls={
            <>
              <ControlSelect label="Measure" value={tileMetric} options={Object.entries(metricLabels).map(([value, label]) => ({ value, label }))} onChange={setTileMetric} />
              <ControlSelect label="Show teams" value={tileTop} options={['12', '24', '48', '91']} onChange={setTileTop} />
            </>
          }
        >
          <ul className={styles.tiles}>
            {teamTiles.map((team) => (
              <li key={team.name}>
                <button
                  type="button"
                  className={styles.tile}
                  aria-pressed={seatFilters.teamName === team.name}
                  onClick={() => toggleSeat('teamName', team.name)}
                  style={{ background: `color-mix(in srgb, var(--color-chart-5) ${tileMetric.endsWith('Percent') ? Math.round(team[tileMetric] * 0.5) : Math.min(50, team[tileMetric] * 4)}%, var(--color-bg))` }}
                >
                  <span className={styles.tileLabel}>{team.name}</span>
                  <span className={styles.tileValue}>
                    {team[tileMetric]}
                    {tileMetric.endsWith('Percent') ? '%' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard
          title={`Department ${metricLabels[deptMetric].toLowerCase()} in ${monthLabel(focus)}`}
          columns={['Department', metricLabels[deptMetric]]}
          rows={departments.map((entry) => [entry.name, entry[deptMetric]])}
          controls={<ControlSelect label="Measure" value={deptMetric} options={Object.entries(metricLabels).map(([value, label]) => ({ value, label }))} onChange={setDeptMetric} />}
        >
          <BarsChart sideways data={departments.map((entry) => ({ name: entry.name, value: entry[deptMetric] }))} activeName={seatFilters.departmentName} onPick={(name) => toggleSeat('departmentName', name)} />
        </ChartCard>

        <ChartCard
          title={`Seat fill rate by department in ${monthLabel(focus)}`}
          columns={['Department', 'Filled seats', 'Seats', 'Fill %']}
          rows={fillRates.map((entry) => [entry.name, entry.filled, entry.seats, entry.fillPercent])}
          controls={<ControlSelect label="Seat type" value={fillSeat} options={[{ value: 'all', label: 'All seats' }, 'Consultant', 'Lead Consultant']} onChange={setFillSeat} />}
        >
          <BarsChart sideways data={fillRates.map((entry) => ({ name: entry.name, value: entry.fillPercent }))} activeName={seatFilters.departmentName} onPick={(name) => toggleSeat('departmentName', name)} />
        </ChartCard>

        <ChartCard
          title={`Vacant seats in ${monthLabel(focus)}`}
          columns={['Name', 'Vacant seats']}
          rows={vacant.map((entry) => [entry.name, entry.vacantSeats])}
          controls={
            <>
              <ControlSelect label="Rank" value={vacantBy} options={[{ value: 'teamName', label: 'Teams' }, { value: 'departmentName', label: 'Departments' }, { value: 'practiceName', label: 'Practices' }]} onChange={setVacantBy} />
              <ControlSelect label="Show top" value={vacantTop} options={TOP_OPTIONS} onChange={setVacantTop} />
            </>
          }
        >
          <BarsChart sideways data={vacant.map((entry) => ({ name: entry.name, value: entry.vacantSeats }))} activeName={seatFilters[vacantBy]} onPick={(name) => toggleSeat(vacantBy, name)} />
        </ChartCard>

        <ChartCard
          tableOnly
          title="People to look at"
          columns={['Employee', 'Designation', 'Location', 'Allocation %', 'Total experience (years)']}
          rows={listed.map((row) => [`${row.name} (${row.employeeId})`, labelOf(row.designation), labelOf(row.locationType), row.allocation, row.totalExperience])}
          summary={listMode === 'none' ? 'Not deployed today, most experienced first.' : listMode === 'over' ? 'Allocated above 100%.' : 'Partly allocated, lowest allocation first.'}
          controls={
            <>
              <ControlSelect label="Show" value={listMode} options={BUCKET_ORDER.filter((key) => key !== 'full').map((key) => ({ value: key, label: BUCKET_LABELS[key] }))} onChange={setListMode} />
              <ControlSelect label="Rows" value={listTop} options={['10', '25', '50']} onChange={setListTop} />
            </>
          }
        />

        <ChartCard
          wide
          title="Hours by month"
          columns={monthMode === 'hours' ? ['Month', 'Available hours', 'Allocated hours', 'Utilized hours'] : ['Month', 'Allocated %', 'Utilized %']}
          rows={months.map((entry) => (monthMode === 'hours' ? [entry.label, hours(entry.available), hours(entry.allocated), hours(entry.utilized)] : [entry.label, entry.allocationPercent, entry.utilizationPercent]))}
          controls={<ControlSelect label="Show" value={monthMode} options={[{ value: 'hours', label: 'Hours' }, { value: 'percent', label: 'Percentages' }]} onChange={setMonthMode} />}
          summary="Utilized hours follow the Control Center rule: allocated hours scaled by the share of the month the team has a project assignment. Click a month to focus on it."
        >
          {monthMode === 'hours' ? (
            <TrendChart data={months} bars={[{ key: 'available', label: 'Available hours', color: 'var(--color-chart-3)' }, { key: 'allocated', label: 'Allocated hours', color: 'var(--color-chart-5)' }]} lines={[{ key: 'utilized', label: 'Utilized hours', color: 'var(--color-chart-1)' }]} activeKey={focus} onPick={setFocusChoice} />
          ) : (
            <TrendChart data={months} lines={[{ key: 'allocationPercent', label: 'Allocated %', right: true, color: 'var(--color-chart-5)' }, { key: 'utilizationPercent', label: 'Utilized %', right: true, color: 'var(--color-chart-1)' }]} percentAxis />
          )}
        </ChartCard>

        <ChartCard
          title="Allocation and utilization trend"
          columns={['Month', ...lineGroups]}
          rows={lineData.map((entry) => [entry.label, ...lineGroups.map((group) => entry[group])])}
          controls={
            <>
              <ControlSelect label="Measure" value={lineMetric} options={[{ value: 'utilizationPercent', label: 'Utilized %' }, { value: 'allocationPercent', label: 'Allocated %' }]} onChange={setLineMetric} />
              <ControlSelect label="One line per" value={lineBy} options={[{ value: 'total', label: 'All seats' }, { value: 'department', label: 'Department' }, { value: 'practice', label: 'Practice' }]} onChange={setLineBy} />
            </>
          }
        >
          <TrendChart data={lineData} lines={lineGroups.map((group) => ({ key: group, label: group, right: true }))} percentAxis />
        </ChartCard>

        <ChartCard
          title="Vacant hours by month"
          columns={['Month', ...benchNames]}
          rows={benchData.map((entry) => [entry.label, ...benchNames.map((name) => entry[name])])}
          controls={<ControlSelect label="Stack by" value={benchBy} options={[{ value: 'positionName', label: 'Seat type' }, { value: 'departmentName', label: 'Department' }, { value: 'practiceName', label: 'Practice' }]} onChange={setBenchBy} />}
        >
          <TrendChart data={benchData} areas={benchNames.map((name) => ({ key: name, label: name }))} />
        </ChartCard>

        <ChartCard
          title="How allocation is spread"
          columns={['Allocation %', 'People']}
          rows={bands.map((entry) => [entry.label, entry.value])}
          controls={
            <>
              <ControlSelect label="Band width (%)" value={bandWidth} options={['10', '25', '50']} onChange={setBandWidth} />
              <ControlSelect label="Include people not deployed" value={bandNone} options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} onChange={setBandNone} />
            </>
          }
        >
          <BarsChart data={bands.map((entry) => ({ name: entry.label, value: entry.value }))} />
        </ChartCard>

        <ChartCard
          wide
          title={`Hours by department, team and seat type in ${monthLabel(focus)}`}
          columns={['Department', 'Team', 'Seat type', 'Hours']}
          rows={sunRows}
          controls={<ControlSelect label="Hours" value={sunMetric} options={[{ value: 'allocated', label: 'Allocated' }, { value: 'available', label: 'Available' }, { value: 'vacant', label: 'Vacant' }]} onChange={setSunMetric} />}
        >
          <SunburstView data={sunTree} />
        </ChartCard>
      </div>
    </div>
  );
}

function keyOfLabel(label) {
  return BUCKET_ORDER.find((key) => BUCKET_LABELS[key] === label);
}

AllocationTab.propTypes = {
  people: PropTypes.arrayOf(PropTypes.object).isRequired,
  filters: PropTypes.objectOf(PropTypes.string).isRequired,
  onToggle: PropTypes.func.isRequired,
  refreshKey: PropTypes.number.isRequired,
};

export default AllocationTab;
