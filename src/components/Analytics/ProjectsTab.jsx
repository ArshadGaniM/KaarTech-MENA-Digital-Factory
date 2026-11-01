import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useAnalyticsAssignments, useAnalyticsStructure } from '../../hooks/useAnalyticsData';
import { useCrossFilters } from '../../hooks/useCrossFilters';
import { applyFilters, applyFiltersExcept, countBy, histogram, labelOf, monthCoverage, monthLabel, monthsFromTo, overlapsMonth, spanDays, teamLabel } from '../../lib/analyticsData';
import { formatCount } from '../../lib/formatCount';
import { currentMonth, shiftMonth } from '../../lib/months';
import ChartCard from './ChartCard';
import ControlSelect from './Controls';
import Gantt from './Gantt';
import LoadGate from './LoadGate';
import SlicerBar from './SlicerBar';
import { BarsChart, DonutPie, Heatmap, TrendChart } from './charts';
import styles from './Analytics.module.css';

const NO_FILTERS = { project: null, profitCenter: null, departmentName: null, team: null, practiceName: null };
const SLICERS = [
  { field: 'project', label: 'Project' },
  { field: 'profitCenter', label: 'Profit center' },
  { field: 'departmentName', label: 'Department' },
  { field: 'team', label: 'Team' },
  { field: 'practiceName', label: 'Practice' },
];
const LABELS = Object.fromEntries(SLICERS.map((slicer) => [slicer.field, slicer.label]));
const TOP_OPTIONS = ['5', '10', '15', '20'];
const MONTH_CHOICES = Array.from({ length: 24 }, (_, i) => i - 11);
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (isoDate, days) => new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const distinct = (rows, field) => new Set(rows.map((row) => row[field])).size;

function Charts({ assignments, teams, filters, onToggle, onSet }) {
  const base = currentMonth();
  const [from, setFrom] = useState(shiftMonth(base, -2));
  const [to, setTo] = useState(shiftMonth(base, 6));
  const [focusChoice, setFocusChoice] = useState(base);
  const [sortBy, setSortBy] = useState('start');
  const [ganttRows, setGanttRows] = useState('10');
  const [teamsTop, setTeamsTop] = useState('10');
  const [gridRows, setGridRows] = useState('10');
  const [centerBy, setCenterBy] = useState('assignments');
  const [band, setBand] = useState('2');
  const [windowDays, setWindowDays] = useState('90');
  const [idleTop, setIdleTop] = useState('10');

  const monthOptions = MONTH_CHOICES.map((offset) => ({ value: shiftMonth(base, offset), label: monthLabel(shiftMonth(base, offset)) }));
  const months = monthsFromTo(from, to);
  const focus = focusChoice < from ? from : focusChoice > to ? to : focusChoice;
  const rows = useMemo(() => applyFilters(assignments, filters), [assignments, filters]);
  const except = (field) => applyFiltersExcept(assignments, filters, field);

  // 31: when each team works on which project.
  const sorted = [...rows].sort((a, b) => (sortBy === 'start' ? a.start.localeCompare(b.start) : sortBy === 'end' ? a.end.localeCompare(b.end) : a[sortBy].localeCompare(b[sortBy])) || a.team.localeCompare(b.team));
  const shown = sorted.slice(0, ganttRows === 'all' ? sorted.length : Number(ganttRows));

  // 32: how many projects and teams are active each month.
  const active = months.map((month) => {
    const inMonth = rows.filter((row) => overlapsMonth(row, month));
    return { month, label: monthLabel(month), projects: distinct(inMonth, 'projectId'), teams: distinct(inMonth, 'teamCode') };
  });

  // 33: how many teams work on each project.
  const teamsPerProject = (() => {
    const byProject = new Map();
    for (const row of except('project')) {
      if (!byProject.has(row.project)) byProject.set(row.project, new Set());
      byProject.get(row.project).add(row.teamCode);
    }
    return [...byProject].map(([name, set]) => ({ name, value: set.size })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, Number(teamsTop));
  })();

  // 34: how much of each month each team has a project.
  const gridTeams = countBy(rows, 'team').slice(0, Number(gridRows)).map((entry) => entry.name);
  const coverage = new Map(gridTeams.map((team) => [team, Object.fromEntries(months.map((month) => [month, monthCoverage(rows.filter((row) => row.team === team), month)]))]));

  // 35: how the work splits by profit center.
  const centers = (() => {
    const byCenter = new Map();
    for (const row of except('profitCenter')) {
      if (!byCenter.has(row.profitCenter)) byCenter.set(row.profitCenter, []);
      byCenter.get(row.profitCenter).push(row);
    }
    return [...byCenter]
      .map(([name, list]) => ({ name, value: centerBy === 'assignments' ? list.length : distinct(list, centerBy === 'teams' ? 'teamCode' : 'projectId') }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  })();

  // 36: how long assignments last.
  const durations = histogram(rows.map((row) => spanDays(row.start, row.end) / 30), Number(band)).map((entry) => ({ name: `${entry.from}-${entry.to}`, value: entry.value }));

  // 37: which assignments end soon.
  const startDay = today();
  const endDay = addDays(startDay, Number(windowDays));
  const ending = rows.filter((row) => row.end >= startDay && row.end <= endDay);
  const endingByMonth = [...new Set(ending.map((row) => row.end.slice(0, 7)))].sort().map((month) => {
    const inMonth = ending.filter((row) => row.end.startsWith(month));
    return { name: monthLabel(month), value: inMonth.length, teams: distinct(inMonth, 'teamCode') };
  });

  // 38: teams with no project at all in the focus month.
  const busy = new Set(assignments.filter((row) => overlapsMonth(row, focus)).map((row) => row.teamCode));
  const idle = teams.filter((team) => !busy.has(team.teamCode)).sort((a, b) => b.seats - a.seats || a.team.localeCompare(b.team)).slice(0, Number(idleTop));

  const monthSlicers = (
    <>
      <ControlSelect label="From month" value={from} options={monthOptions} onChange={(value) => { setFrom(value); if (value > to) setTo(value); }} />
      <ControlSelect label="To month" value={to} options={monthOptions} onChange={(value) => { setTo(value); if (value < from) setFrom(value); }} />
      <ControlSelect label="Focus month" value={focus} options={monthOptions.filter((option) => option.value >= from && option.value <= to)} onChange={setFocusChoice} />
    </>
  );

  return (
    <div className={styles.page}>
      <div className={styles.slicerBar} role="group" aria-label="Months">
        <div className={styles.slicerRow}>{monthSlicers}</div>
      </div>
      <div className={styles.grid}>
        <ChartCard
          wide
          title="Assignment timeline"
          columns={['Team', 'Project', 'Start', 'End', 'Days']}
          rows={shown.map((row) => [row.team, row.project, row.start, row.end, spanDays(row.start, row.end)])}
          controls={
            <>
              <ControlSelect label="Order by" value={sortBy} options={[{ value: 'start', label: 'Start date' }, { value: 'end', label: 'End date' }, { value: 'team', label: 'Team' }, { value: 'project', label: 'Project' }]} onChange={setSortBy} />
              <ControlSelect label="Rows" value={ganttRows} options={['10', '20', 'all']} onChange={setGanttRows} />
            </>
          }
        >
          {shown.length > 0 && <Gantt rows={shown.map((row, index) => ({ key: `${row.teamCode}-${row.projectId}-${row.start}-${index}`, label: row.team, sub: row.project, start: row.start, end: row.end }))} />}
        </ChartCard>

        <ChartCard
          title="Active projects and teams by month"
          summary="Click a month to focus on it."
          columns={['Month', 'Projects', 'Teams']}
          rows={active.map((entry) => [entry.label, entry.projects, entry.teams])}
        >
          <TrendChart data={active} bars={[{ key: 'projects', label: 'Projects', color: 'var(--color-chart-5)' }]} lines={[{ key: 'teams', label: 'Teams', color: 'var(--color-chart-1)' }]} activeKey={focus} onPick={setFocusChoice} />
        </ChartCard>

        <ChartCard
          title="Teams per project"
          columns={['Project', 'Teams']}
          rows={teamsPerProject.map((entry) => [entry.name, entry.value])}
          controls={<ControlSelect label="Show top" value={teamsTop} options={TOP_OPTIONS} onChange={setTeamsTop} />}
        >
          <BarsChart sideways data={teamsPerProject} activeName={filters.project} onPick={(name) => onToggle('project', name)} />
        </ChartCard>

        <ChartCard
          wide
          title="Share of each month covered by a project"
          summary="Each cell is the percentage of the month's days with at least one assignment."
          columns={['Team', ...months.map(monthLabel)]}
          rows={gridTeams.map((team) => [team, ...months.map((month) => coverage.get(team)[month])])}
          controls={<ControlSelect label="Teams" value={gridRows} options={['10', '15', '25']} onChange={setGridRows} />}
        >
          <Heatmap rowLabel="Team" rowNames={gridTeams} colNames={months} colLabels={Object.fromEntries(months.map((month) => [month, monthLabel(month)]))} cell={(team, month) => coverage.get(team)[month]} onPick={(team) => onSet('team', team)} />
        </ChartCard>

        <ChartCard
          title="Work by profit center"
          columns={['Profit center', centerBy === 'teams' ? 'Teams' : centerBy === 'projects' ? 'Projects' : 'Assignments']}
          rows={centers.map((entry) => [entry.name, entry.value])}
          controls={<ControlSelect label="Count" value={centerBy} options={[{ value: 'assignments', label: 'Assignments' }, { value: 'teams', label: 'Teams' }, { value: 'projects', label: 'Projects' }]} onChange={setCenterBy} />}
        >
          <DonutPie data={centers} activeName={filters.profitCenter} onPick={(name) => onToggle('profitCenter', name)} total={formatCount(centers.reduce((sum, entry) => sum + entry.value, 0))} centerLabel={centerBy} />
        </ChartCard>

        <ChartCard
          title="How long assignments last"
          columns={['Months', 'Assignments']}
          rows={durations.map((entry) => [entry.name, entry.value])}
          controls={<ControlSelect label="Band width (months)" value={band} options={['1', '2', '3', '6']} onChange={setBand} />}
        >
          <BarsChart data={durations} />
        </ChartCard>

        <ChartCard
          title="Assignments ending soon"
          summary={`Ending from ${startDay} to ${endDay}.`}
          columns={['Month', 'Assignments', 'Teams']}
          rows={endingByMonth.map((entry) => [entry.name, entry.value, entry.teams])}
          controls={<ControlSelect label="Within" value={windowDays} options={[{ value: '30', label: '30 days' }, { value: '60', label: '60 days' }, { value: '90', label: '90 days' }, { value: '180', label: '180 days' }, { value: '365', label: '365 days' }]} onChange={setWindowDays} />}
        >
          <BarsChart data={endingByMonth} />
        </ChartCard>

        <ChartCard
          tableOnly
          title={`Teams with no project in ${monthLabel(focus)}`}
          columns={['Team', 'Department', 'Practice', 'Positions']}
          rows={idle.map((team) => [team.team, labelOf(team.departmentName), labelOf(team.practiceName), team.seats])}
          controls={<ControlSelect label="Rows" value={idleTop} options={['10', '25', '50']} onChange={setIdleTop} />}
        />
      </div>
    </div>
  );
}

Charts.propTypes = {
  assignments: PropTypes.arrayOf(PropTypes.object).isRequired,
  teams: PropTypes.arrayOf(PropTypes.object).isRequired,
  filters: PropTypes.objectOf(PropTypes.string).isRequired,
  onToggle: PropTypes.func.isRequired,
  onSet: PropTypes.func.isRequired,
};

// The project visuals: who works on what, and when it ends.
function ProjectsTab({ refreshKey }) {
  const [retries, setRetries] = useState(0);
  const assigned = useAnalyticsAssignments(refreshKey + retries);
  const structure = useAnalyticsStructure(refreshKey + retries);
  const { filters, toggle, set, clearAll } = useCrossFilters(NO_FILTERS);

  // One row per team, with how many positions it holds, so a team with no
  // assignment can still be listed.
  const teams = useMemo(() => {
    const byTeam = new Map();
    for (const row of structure.data?.rows ?? []) {
      const entry = byTeam.get(row.teamCode) ?? { teamCode: row.teamCode, team: teamLabel(row.teamCode, row.teamName), departmentName: row.departmentName, practiceName: row.practiceName, seats: 0 };
      entry.seats += 1;
      byTeam.set(row.teamCode, entry);
    }
    return [...byTeam.values()];
  }, [structure.data]);

  const assignments = useMemo(() => {
    const practiceOf = new Map(teams.map((team) => [team.teamCode, team.practiceName]));
    return (assigned.data?.rows ?? []).map((row) => ({ ...row, team: teamLabel(row.teamCode, row.teamName), project: labelOf(row.projectName ?? row.projectId), profitCenter: labelOf(row.profitCenter), practiceName: practiceOf.get(row.teamCode) ?? null }));
  }, [assigned.data, teams]);

  const slicers = SLICERS.map((slicer) => ({ ...slicer, values: [...new Set(assignments.map((row) => labelOf(row[slicer.field])))].sort() }));

  return (
    <div className={styles.page}>
      <LoadGate results={[assigned, structure]} what="the projects" onRetry={() => setRetries((count) => count + 1)}>
        <SlicerBar
          slicers={slicers}
          filters={filters}
          labels={LABELS}
          onChange={set}
          onReset={clearAll}
          matching={`${formatCount(applyFilters(assignments, filters).length)} of ${formatCount(assignments.length)} assignments`}
        />
        <Charts assignments={assignments} teams={teams.filter((team) => (filters.departmentName === null || labelOf(team.departmentName) === filters.departmentName) && (filters.practiceName === null || labelOf(team.practiceName) === filters.practiceName) && (filters.team === null || team.team === filters.team))} filters={filters} onToggle={toggle} onSet={set} />
      </LoadGate>
    </div>
  );
}

ProjectsTab.propTypes = {
  refreshKey: PropTypes.number.isRequired,
};

export default ProjectsTab;
