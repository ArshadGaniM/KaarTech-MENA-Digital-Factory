import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useAnalyticsCatalog, useAnalyticsStructure } from '../../hooks/useAnalyticsData';
import { useCrossFilters } from '../../hooks/useCrossFilters';
import { applyFilters, applyFiltersExcept, countBy, labelOf, teamLabel, topWithOther } from '../../lib/analyticsData';
import { formatCount } from '../../lib/formatCount';
import ChartCard from './ChartCard';
import ControlSelect from './Controls';
import LoadGate from './LoadGate';
import SlicerBar from './SlicerBar';
import { BarsChart, Heatmap, TileMap } from './charts';
import styles from './Analytics.module.css';

const COUNTED = new Set(['Consultant', 'Lead Consultant']);
const NO_FILTERS = { departmentName: null, team: null, practiceName: null, positionName: null };
const SLICERS = [
  { field: 'departmentName', label: 'Department' },
  { field: 'team', label: 'Team' },
  { field: 'practiceName', label: 'Practice' },
  { field: 'positionName', label: 'Position' },
];
const LABELS = Object.fromEntries(SLICERS.map((slicer) => [slicer.field, slicer.label]));
const TOP_OPTIONS = ['5', '10', '15', '20'];
const MEASURES = [
  { value: 'positions', label: 'All positions' },
  { value: 'seats', label: 'Consultant and Lead Consultant seats' },
  { value: 'filled', label: 'Positions with someone deployed' },
];
const keep = (rows, measure) => rows.filter((row) => (measure === 'seats' ? COUNTED.has(row.positionName) : measure === 'filled' ? row.filled : true));

// Pairs of (a, b) for every value of the list field each row holds.
function pairCounts(rows, nameOf, listOf) {
  const counts = new Map();
  for (const row of rows) {
    for (const item of new Set(listOf(row))) {
      const key = `${nameOf(row)}\u0000${item}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function Charts({ positions, catalog, filters, onToggle, onSet }) {
  const [teamMeasure, setTeamMeasure] = useState('positions');
  const [teamTop, setTeamTop] = useState('10');
  const [deptMeasure, setDeptMeasure] = useState('teams');
  const [mixTop, setMixTop] = useState('10');
  const [gridRows, setGridRows] = useState('10');
  const [gridCols, setGridCols] = useState('10');
  const [demandBy, setDemandBy] = useState('competency');
  const [demandTop, setDemandTop] = useState('10');
  const [portfolio, setPortfolio] = useState('all');
  const [floorMeasure, setFloorMeasure] = useState('teams');
  const [ioShow, setIoShow] = useState('all');

  const rows = useMemo(() => applyFilters(positions, filters), [positions, filters]);
  const except = (field) => applyFiltersExcept(positions, filters, field);

  const practiceOfCompetency = new Map(catalog.filter((row) => row.kind === 'competency').map((row) => [row.name, labelOf(row.practiceName)]));
  const departments = catalog.filter((row) => row.kind === 'department');

  // 23: how big each team is.
  const teams = countBy(keep(except('team'), teamMeasure), 'team').slice(0, Number(teamTop));

  // 24: how each department is made up.
  const deptRows = except('departmentName');
  const deptData = (() => {
    if (deptMeasure === 'positions') return countBy(deptRows, 'departmentName');
    if (deptMeasure === 'seats') return countBy(keep(deptRows, 'seats'), 'departmentName');
    return countBy([...new Map(deptRows.map((row) => [row.teamCode, row])).values()], 'departmentName');
  })();

  // 25: which positions each team holds.
  const teamNames = countBy(except('team'), 'team').slice(0, Number(mixTop)).map((entry) => entry.name);
  const mixNames = countBy(rows, 'positionName').slice(0, 6).map((entry) => entry.name);
  const mixData = teamNames.map((name) => ({
    name,
    ...Object.fromEntries(mixNames.map((position) => [position, except('team').filter((row) => row.team === name && row.positionName === position).length])),
  }));

  // 26: which competencies each team covers.
  const gridTeams = countBy(rows, 'team').slice(0, Number(gridRows)).map((entry) => entry.name);
  const competencyCounts = new Map();
  for (const row of rows) for (const name of new Set(row.competencies)) competencyCounts.set(name, (competencyCounts.get(name) ?? 0) + 1);
  const gridCompetencies = [...competencyCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, Number(gridCols)).map(([name]) => name);
  const pairs = pairCounts(rows, (row) => row.team, (row) => row.competencies);

  // 27: where the demand for competencies sits.
  const demand = (() => {
    const counts = new Map();
    for (const [name, count] of competencyCounts) {
      const key = demandBy === 'practice' ? (practiceOfCompetency.get(name) ?? 'Not set') : name;
      counts.set(key, (counts.get(key) ?? 0) + count);
    }
    return topWithOther([...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)), Number(demandTop)).filter((entry) => entry.name !== 'Other');
  })();

  // 28: what each practice holds.
  const practiceNames = catalog.filter((row) => row.kind === 'practice').map((row) => row.name).sort();
  const teamsOfPractice = new Map();
  for (const row of except('practiceName')) {
    if (!teamsOfPractice.has(labelOf(row.practiceName))) teamsOfPractice.set(labelOf(row.practiceName), new Set());
    teamsOfPractice.get(labelOf(row.practiceName)).add(row.teamCode);
  }
  const portfolioSeries = [
    { key: 'Competencies', label: 'Competencies', show: portfolio === 'all' || portfolio === 'competencies' },
    { key: 'Modules', label: 'Modules', show: portfolio === 'all' || portfolio === 'modules' },
    { key: 'Teams', label: 'Teams', show: portfolio === 'all' || portfolio === 'teams' },
  ].filter((series) => series.show);
  const portfolioData = practiceNames.map((name) => ({
    name,
    Competencies: catalog.filter((row) => row.kind === 'competency' && row.practiceName === name).length,
    Modules: catalog.filter((row) => row.kind === 'module' && row.practiceName === name).length,
    Teams: teamsOfPractice.get(name)?.size ?? 0,
  }));

  // 29: what sits on each floor.
  const floors = (() => {
    const byDepartment = new Map(countBy(floorMeasure === 'positions' ? deptRows : [...new Map(deptRows.map((row) => [row.teamCode, row])).values()], 'departmentName').map((entry) => [entry.name, entry.value]));
    const totals = new Map();
    for (const department of departments) {
      if (department.floorNumber === null) continue;
      const value = floorMeasure === 'departments' ? 1 : (byDepartment.get(department.name) ?? 0);
      totals.set(department.floorNumber, (totals.get(department.floorNumber) ?? 0) + value);
    }
    return [...totals].sort((a, b) => b[0] - a[0]).map(([floor, value]) => ({ name: `Floor ${floor}`, value }));
  })();

  // 30: what each department takes in and hands on.
  const ioRows = departments
    .filter((row) => filters.departmentName === null || row.name === filters.departmentName)
    .filter((row) => (ioShow === 'input' ? row.input : ioShow === 'output' ? row.output : true))
    .map((row) => [row.name, row.floorNumber ?? '–', row.input || '–', row.output || '–']);

  return (
    <div className={styles.grid}>
      <ChartCard
        title="Team size"
        columns={['Team', 'Positions']}
        rows={teams.map((entry) => [entry.name, entry.value])}
        controls={
          <>
            <ControlSelect label="Count" value={teamMeasure} options={MEASURES} onChange={setTeamMeasure} />
            <ControlSelect label="Show top" value={teamTop} options={TOP_OPTIONS} onChange={setTeamTop} />
          </>
        }
      >
        <BarsChart sideways data={teams} activeName={filters.team} onPick={(name) => onToggle('team', name)} />
      </ChartCard>

      <ChartCard
        title="Department structure"
        columns={['Department', deptMeasure === 'teams' ? 'Teams' : deptMeasure === 'seats' ? 'Seats' : 'Positions']}
        rows={deptData.map((entry) => [entry.name, entry.value])}
        controls={<ControlSelect label="Size by" value={deptMeasure} options={[{ value: 'teams', label: 'Teams' }, { value: 'positions', label: 'Positions' }, { value: 'seats', label: 'Seats' }]} onChange={setDeptMeasure} />}
      >
        <TileMap data={deptData} activeName={filters.departmentName} onPick={(name) => onToggle('departmentName', name)} />
      </ChartCard>

      <ChartCard
        title="Position mix per team"
        columns={['Team', ...mixNames]}
        rows={mixData.map((entry) => [entry.name, ...mixNames.map((name) => entry[name])])}
        controls={<ControlSelect label="Show top teams" value={mixTop} options={TOP_OPTIONS} onChange={setMixTop} />}
      >
        <BarsChart sideways stacked data={mixData} series={mixNames.map((name) => ({ key: name, label: name }))} onPick={(name) => onToggle('team', name)} />
      </ChartCard>

      <ChartCard
        wide
        title="Competency coverage by team"
        summary="Each cell counts the positions of a team that list the competency."
        columns={['Team', ...gridCompetencies]}
        rows={gridTeams.map((team) => [team, ...gridCompetencies.map((name) => pairs.get(`${team}\u0000${name}`) ?? 0)])}
        controls={
          <>
            <ControlSelect label="Teams" value={gridRows} options={['10', '15', '25']} onChange={setGridRows} />
            <ControlSelect label="Competencies" value={gridCols} options={['5', '10', '15']} onChange={setGridCols} />
          </>
        }
      >
        <Heatmap rowLabel="Team" rowNames={gridTeams} colNames={gridCompetencies} cell={(team, name) => pairs.get(`${team}\u0000${name}`) ?? 0} onPick={(team) => onSet('team', team)} />
      </ChartCard>

      <ChartCard
        title="Competency demand"
        summary="Each position counts once under every competency it lists."
        columns={[demandBy === 'practice' ? 'Practice' : 'Competency', 'Positions']}
        rows={demand.map((entry) => [entry.name, entry.value])}
        controls={
          <>
            <ControlSelect label="Group by" value={demandBy} options={[{ value: 'competency', label: 'Competency' }, { value: 'practice', label: 'Practice' }]} onChange={setDemandBy} />
            <ControlSelect label="Show top" value={demandTop} options={TOP_OPTIONS} onChange={setDemandTop} />
          </>
        }
      >
        <BarsChart sideways data={demand} />
      </ChartCard>

      <ChartCard
        title="Practice portfolio"
        columns={['Practice', ...portfolioSeries.map((series) => series.label)]}
        rows={portfolioData.map((entry) => [entry.name, ...portfolioSeries.map((series) => entry[series.key])])}
        controls={<ControlSelect label="Show" value={portfolio} options={[{ value: 'all', label: 'All three' }, { value: 'competencies', label: 'Competencies' }, { value: 'modules', label: 'Modules' }, { value: 'teams', label: 'Teams' }]} onChange={setPortfolio} />}
      >
        <BarsChart data={portfolioData} series={portfolioSeries.map((series) => ({ key: series.key, label: series.label }))} activeName={filters.practiceName} onPick={(name) => onToggle('practiceName', name)} />
      </ChartCard>

      <ChartCard
        title="Departments by floor"
        columns={['Floor', floorMeasure === 'departments' ? 'Departments' : floorMeasure === 'positions' ? 'Positions' : 'Teams']}
        rows={floors.map((entry) => [entry.name, entry.value])}
        controls={<ControlSelect label="Count" value={floorMeasure} options={[{ value: 'teams', label: 'Teams' }, { value: 'positions', label: 'Positions' }, { value: 'departments', label: 'Departments' }]} onChange={setFloorMeasure} />}
      >
        <BarsChart data={floors} />
      </ChartCard>

      <ChartCard
        tableOnly
        title="Department input and output"
        columns={['Department', 'Floor', 'Input', 'Output']}
        rows={ioRows}
        controls={<ControlSelect label="Show" value={ioShow} options={[{ value: 'all', label: 'All departments' }, { value: 'input', label: 'With an input' }, { value: 'output', label: 'With an output' }]} onChange={setIoShow} />}
      />
    </div>
  );
}

Charts.propTypes = {
  positions: PropTypes.arrayOf(PropTypes.object).isRequired,
  catalog: PropTypes.arrayOf(PropTypes.object).isRequired,
  filters: PropTypes.objectOf(PropTypes.string).isRequired,
  onToggle: PropTypes.func.isRequired,
  onSet: PropTypes.func.isRequired,
};

// The structure visuals: teams, departments, practices and competencies.
function StructureTab({ refreshKey }) {
  const [retries, setRetries] = useState(0);
  const structure = useAnalyticsStructure(refreshKey + retries);
  const catalog = useAnalyticsCatalog(refreshKey + retries);
  const { filters, toggle, set, clearAll } = useCrossFilters(NO_FILTERS);

  const positions = useMemo(() => (structure.data?.rows ?? []).map((row) => ({ ...row, team: teamLabel(row.teamCode, row.teamName) })), [structure.data]);
  const slicers = SLICERS.map((slicer) => ({ ...slicer, values: [...new Set(positions.map((row) => labelOf(row[slicer.field])))].sort() }));

  return (
    <div className={styles.page}>
      <LoadGate results={[structure, catalog]} what="the structure" onRetry={() => setRetries((count) => count + 1)}>
        <SlicerBar
          slicers={slicers}
          filters={filters}
          labels={LABELS}
          onChange={set}
          onReset={clearAll}
          matching={`${formatCount(applyFilters(positions, filters).length)} of ${formatCount(positions.length)} positions`}
        />
        <Charts positions={positions} catalog={catalog.data?.rows ?? []} filters={filters} onToggle={toggle} onSet={set} />
      </LoadGate>
    </div>
  );
}

StructureTab.propTypes = {
  refreshKey: PropTypes.number.isRequired,
};

export default StructureTab;
