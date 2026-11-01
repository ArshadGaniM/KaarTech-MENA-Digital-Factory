import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useAnalyticsDeployments, useAnalyticsSeats, useAnalyticsSnapshots } from '../../hooks/useAnalyticsData';
import { labelOf, monthLabel, percent, seatTotalsBy, seatsByMonth, teamLabel } from '../../lib/analyticsData';
import {
  addDays,
  allocationByMonth,
  allocationPercentOf,
  extendDeployments,
  isSeatDeployment,
  monthlySeries,
  utilizationPercentOf,
} from '../../lib/forecast';
import { formatCount } from '../../lib/formatCount';
import { currentMonth, shiftMonth } from '../../lib/months';
import ChartCard from './ChartCard';
import ControlSelect from './Controls';
import LoadGate from './LoadGate';
import { BarsChart, Heatmap, TrendChart } from './charts';
import styles from './Analytics.module.css';

const HORIZONS = [
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
];
const GROUPS = [
  { value: 'departmentName', label: 'Department' },
  { value: 'practiceName', label: 'Practice' },
  { value: 'positionName', label: 'Seat type' },
];
const WINDOWS = [30, 60, 90, 180];
const hours = (value) => Math.round(value);
const toDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const daysBetween = (from, to) => Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000);

// The forecast looks only at what is already booked: deployments you entered,
// read with the Control Center rules. It never guesses new bookings.
function ForecastTab({ refreshKey }) {
  const base = currentMonth();
  const [horizon, setHorizon] = useState('12');
  const [retries, setRetries] = useState(0);
  const key = refreshKey + retries;
  const seatsResult = useAnalyticsSeats(base, shiftMonth(base, 12), key);
  const deploymentsResult = useAnalyticsDeployments(key);
  const snapshotsResult = useAnalyticsSnapshots(key);
  const retry = () => setRetries((count) => count + 1);

  return (
    <div className={styles.page}>
      <div className={styles.slicerBar} role="group" aria-label="Forecast range">
        <div className={styles.slicerRow}>
          <ControlSelect label="Look ahead" value={horizon} options={HORIZONS} onChange={setHorizon} />
        </div>
      </div>
      <LoadGate results={[seatsResult, deploymentsResult]} what="the forecast" onRetry={retry}>
        <Charts
          seats={seatsResult.data?.rows}
          deployments={deploymentsResult.data?.rows}
          snapshots={snapshotsResult.data?.rows}
          snapshotsFailed={Boolean(snapshotsResult.error) && !snapshotsResult.data}
          base={base}
          horizon={Number(horizon)}
        />
      </LoadGate>
    </div>
  );
}

function Charts({ seats: seatRows, deployments, snapshots, snapshotsFailed, base, horizon }) {
  const today = useMemo(() => toDay(), []);
  const months = useMemo(() => Array.from({ length: horizon + 1 }, (_, i) => shiftMonth(base, i)), [base, horizon]);
  const seats = useMemo(() => seatRows.filter((seat) => months.includes(seat.month)).map((seat) => ({ ...seat, team: teamLabel(seat.teamCode, seat.teamName) })), [seatRows, months]);
  const seatDeployments = useMemo(() => deployments.filter(isSeatDeployment), [deployments]);

  const [allocBy, setAllocBy] = useState('total');
  const [cliffBy, setCliffBy] = useState('departmentName');
  const [hireBy, setHireBy] = useState('departmentName');
  const [gridRows, setGridRows] = useState('15');
  const [withinDays, setWithinDays] = useState('90');
  const [extendMonths, setExtendMonths] = useState('3');

  const totals = seatsByMonth(seats).map((entry) => ({ ...entry, label: monthLabel(entry.month), vacantHours: hours(entry.available - entry.allocated) }));
  const allocationSeries = monthlySeries(seats, months, allocBy === 'total' ? null : allocBy, allocationPercentOf);
  const utilizationSeries = monthlySeries(seats, months, null, utilizationPercentOf);
  const hiring = monthlySeries(seats, months, hireBy, (rows) => rows.filter((row) => !row.filled).length);
  const hiringNames = hiring.names.filter((name) => hiring.data.some((entry) => entry[name] > 0));

  const costs = months.map((month) => {
    const inMonth = seats.filter((seat) => seat.month === month);
    return { month, label: monthLabel(month), onsite: hours(inMonth.reduce((sum, seat) => sum + seat.onsiteCost, 0)), offshore: hours(inMonth.reduce((sum, seat) => sum + seat.offshoreCost, 0)) };
  });

  const history = (() => {
    const saved = new Map();
    for (const row of snapshots ?? []) {
      const entry = saved.get(row.month) ?? { available: 0, allocated: 0 };
      entry.available += row.availableHours;
      entry.allocated += row.allocatedHours;
      saved.set(row.month, entry);
    }
    const booked = new Map(totals.map((entry) => [entry.month, percent(entry.allocated, entry.available)]));
    const all = [...new Set([...saved.keys(), ...booked.keys()])].sort();
    return all.map((month) => {
      const entry = saved.get(month);
      return { month, label: monthLabel(month), saved: entry ? percent(entry.allocated, entry.available) : null, booked: booked.get(month) ?? null };
    });
  })();

  const ending = seatDeployments.filter((deployment) => deployment.end >= today && deployment.end <= addDays(today, 180));
  const cliffGroups = [...new Set(ending.map((deployment) => labelOf(deployment[cliffBy])))].sort();
  const cliff = WINDOWS.map((limit, index) => {
    const lower = index === 0 ? -1 : WINDOWS[index - 1];
    const inWindow = ending.filter((deployment) => {
      const left = daysBetween(today, deployment.end);
      return left > lower && left <= limit;
    });
    return {
      name: `Within ${limit} days`,
      ...Object.fromEntries(cliffGroups.map((group) => [group, inWindow.filter((deployment) => labelOf(deployment[cliffBy]) === group).length])),
    };
  });

  const scenario = useMemo(() => extendDeployments(seatDeployments, today, { withinDays: Number(withinDays), months: Number(extendMonths) }), [seatDeployments, today, withinDays, extendMonths]);
  const baseline = allocationByMonth(seats, seatDeployments, months, today);
  const changed = allocationByMonth(seats, scenario, months, today);
  const compare = months.map((month, index) => ({
    month,
    label: monthLabel(month),
    baseline: baseline[index].percent,
    scenario: changed[index].percent,
    extraHours: hours(changed[index].allocated - baseline[index].allocated),
  }));

  const teamTotals = seatTotalsBy(seats.filter((seat) => seat.month === base), 'team').sort((a, b) => b.vacantSeats - a.vacantSeats || a.name.localeCompare(b.name)).slice(0, Number(gridRows));
  const gridTeams = teamTotals.map((entry) => entry.name);
  const gridCells = new Map();
  for (const seat of seats) {
    const cell = gridCells.get(`${seat.team}\u0000${seat.month}`) ?? { available: 0, allocated: 0 };
    cell.available += seat.availableHours;
    cell.allocated += seat.allocatedHours;
    gridCells.set(`${seat.team}\u0000${seat.month}`, cell);
  }
  const gridValue = (team, month) => {
    const cell = gridCells.get(`${team}\u0000${month}`);
    return cell ? percent(cell.allocated, cell.available) : 0;
  };

  const first = totals[0];
  const last = totals[totals.length - 1];

  return (
    <div className={styles.grid}>
      <ChartCard
        wide
        title="Booked allocation by month"
        summary={first && last ? `Allocation is ${percent(first.allocated, first.available)}% this month and ${percent(last.allocated, last.available)}% in ${last.label}, counting only deployments already entered.` : undefined}
        columns={['Month', ...allocationSeries.names]}
        rows={allocationSeries.data.map((entry) => [entry.label, ...allocationSeries.names.map((name) => entry[name] ?? '–')])}
        controls={<ControlSelect label="One line per" value={allocBy} options={[{ value: 'total', label: 'All seats' }, ...GROUPS]} onChange={setAllocBy} />}
      >
        <TrendChart data={allocationSeries.data} lines={allocationSeries.names.slice(0, 6).map((name) => ({ key: name, label: name, right: true }))} percentAxis />
      </ChartCard>

      <ChartCard
        title="Available hours and bench"
        columns={['Month', 'Available hours', 'Allocated hours', 'Vacant hours']}
        rows={totals.map((entry) => [entry.label, hours(entry.available), hours(entry.allocated), entry.vacantHours])}
      >
        <TrendChart data={totals.map((entry) => ({ ...entry, available: hours(entry.available), allocated: hours(entry.allocated) }))} bars={[{ key: 'allocated', label: 'Allocated hours', color: 'var(--color-chart-5)' }, { key: 'vacantHours', label: 'Vacant hours', color: 'var(--color-chart-3)' }]} />
      </ChartCard>

      <ChartCard
        title="Booked utilization by month"
        summary="Utilized hours are allocated hours scaled by the share of the month the team has a project assignment."
        columns={['Month', 'Utilized %']}
        rows={utilizationSeries.data.map((entry) => [entry.label, entry['All seats'] ?? '–'])}
      >
        <TrendChart data={utilizationSeries.data} lines={[{ key: 'All seats', label: 'Utilized %', right: true }]} percentAxis />
      </ChartCard>

      <ChartCard
        wide
        title="Saved months and booked months"
        state={snapshotsFailed ? 'unavailable' : undefined}
        summary="Saved months come from the monthly snapshots the backend stores. Booked months come from today's deployments."
        columns={['Month', 'Saved allocation %', 'Booked allocation %']}
        rows={history.map((entry) => [entry.label, entry.saved ?? '–', entry.booked ?? '–'])}
      >
        <TrendChart data={history} lines={[{ key: 'saved', label: 'Saved allocation %', right: true, color: 'var(--color-chart-1)' }, { key: 'booked', label: 'Booked allocation %', right: true, color: 'var(--color-chart-5)' }]} percentAxis />
      </ChartCard>

      <ChartCard
        title="Deployments ending soon"
        summary="Seat deployments that end inside each window, from today. A person with two deployments counts twice."
        columns={['Window', ...cliffGroups]}
        rows={cliff.map((entry) => [entry.name, ...cliffGroups.map((group) => entry[group])])}
        controls={<ControlSelect label="Group by" value={cliffBy} options={[{ value: 'departmentName', label: 'Department' }, { value: 'positionName', label: 'Seat type' }]} onChange={setCliffBy} />}
      >
        <BarsChart stacked data={cliff} series={cliffGroups.map((group) => ({ key: group, label: group }))} />
      </ChartCard>

      <ChartCard
        title="Vacant seats by month"
        summary="Seats with nobody deployed, which is the hiring need if nothing new is booked."
        columns={['Month', ...hiringNames]}
        rows={hiring.data.map((entry) => [entry.label, ...hiringNames.map((name) => entry[name])])}
        controls={<ControlSelect label="Stack by" value={hireBy} options={GROUPS} onChange={setHireBy} />}
      >
        <TrendChart data={hiring.data} areas={hiringNames.slice(0, 6).map((name) => ({ key: name, label: name }))} />
      </ChartCard>

      <ChartCard
        wide
        title="What if deployments were extended"
        summary="Moves the end of every deployment that finishes within the chosen days. Nothing is saved."
        columns={['Month', 'Booked %', 'With extension %', 'Extra hours']}
        rows={compare.map((entry) => [entry.label, entry.baseline, entry.scenario, entry.extraHours])}
        controls={
          <>
            <ControlSelect label="Ending within" value={withinDays} options={[{ value: '30', label: '30 days' }, { value: '60', label: '60 days' }, { value: '90', label: '90 days' }, { value: '180', label: '180 days' }]} onChange={setWithinDays} />
            <ControlSelect label="Extend by" value={extendMonths} options={[{ value: '0', label: 'No extension' }, { value: '1', label: '1 month' }, { value: '3', label: '3 months' }, { value: '6', label: '6 months' }]} onChange={setExtendMonths} />
          </>
        }
      >
        <TrendChart data={compare} lines={[{ key: 'baseline', label: 'Booked %', right: true, color: 'var(--color-chart-3)' }, { key: 'scenario', label: 'With extension %', right: true, color: 'var(--color-chart-5)' }]} percentAxis />
      </ChartCard>

      <ChartCard
        tableOnly
        title="Booked against extended"
        columns={['Month', 'Booked %', 'With extension %', 'Extra hours']}
        rows={compare.map((entry) => [entry.label, entry.baseline, entry.scenario, entry.extraHours])}
      />

      <ChartCard
        wide
        title="Monthly cost of booked seats"
        summary="USD per month, by the Control Center cost rules."
        columns={['Month', 'Onsite', 'Offshore']}
        rows={costs.map((entry) => [entry.label, formatCount(entry.onsite), formatCount(entry.offshore)])}
      >
        <TrendChart data={costs} bars={[{ key: 'onsite', label: 'Onsite', color: 'var(--color-chart-1)' }, { key: 'offshore', label: 'Offshore', color: 'var(--color-chart-5)' }]} />
      </ChartCard>

      <ChartCard
        wide
        title="Capacity by team and month"
        summary="Allocation percentage. Teams with the most vacant seats this month come first."
        columns={['Team', ...months.map(monthLabel)]}
        rows={gridTeams.map((team) => [team, ...months.map((month) => gridValue(team, month))])}
        controls={<ControlSelect label="Teams" value={gridRows} options={['10', '15', '25']} onChange={setGridRows} />}
      >
        <Heatmap rowLabel="Team" rowNames={gridTeams} colNames={months} colLabels={Object.fromEntries(months.map((month) => [month, monthLabel(month)]))} cell={gridValue} />
      </ChartCard>
    </div>
  );
}

Charts.propTypes = {
  seats: PropTypes.arrayOf(PropTypes.object).isRequired,
  deployments: PropTypes.arrayOf(PropTypes.object).isRequired,
  snapshots: PropTypes.arrayOf(PropTypes.object),
  snapshotsFailed: PropTypes.bool.isRequired,
  base: PropTypes.string.isRequired,
  horizon: PropTypes.number.isRequired,
};

ForecastTab.propTypes = {
  refreshKey: PropTypes.number.isRequired,
};

export default ForecastTab;
