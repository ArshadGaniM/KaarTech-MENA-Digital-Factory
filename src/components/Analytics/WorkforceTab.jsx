import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import AnimatedNumber from '../AnimatedNumber';
import {
  applyFilters,
  applyFiltersExcept,
  average,
  countBy,
  countListBy,
  crossTab,
  histogram,
  labelOf,
  percent,
  topWithOther,
} from '../../lib/analyticsData';
import { formatCount } from '../../lib/formatCount';
import ChartCard from './ChartCard';
import ControlSelect from './Controls';
import { BarsChart, DonutPie, Heatmap, ScatterPlot, TreemapChart } from './charts';
import styles from './Analytics.module.css';

const DIMENSIONS = [
  { value: 'locationType', label: 'Location type' },
  { value: 'employmentType', label: 'Employment type' },
  { value: 'region', label: 'Region' },
  { value: 'designation', label: 'Designation' },
];
const TOP_OPTIONS = ['5', '10', '15', '20'];
const EXPERIENCE_FIELDS = [
  { value: 'totalExperience', label: 'Total experience' },
  { value: 'kaarExperience', label: 'Kaar experience' },
  { value: 'sapExperience', label: 'SAP experience' },
];
const BAND_OPTIONS = ['1', '2', '5'];
const oneDecimal = (value) => (value === null ? '–' : (Math.round(value * 10) / 10).toFixed(1));

// The workforce visuals. Every chart reads the people the slicers leave, except
// that a chart ignores the slicer on its own field, so it keeps all its slices
// and a click on one can switch the slicer.
function WorkforceTab({ people, filters, onToggle, onSet }) {
  const [donutBy, setDonutBy] = useState('locationType');
  const [subTop, setSubTop] = useState('10');
  const [designationTop, setDesignationTop] = useState('10');
  const [regionSplit, setRegionSplit] = useState('none');
  const [skillTop, setSkillTop] = useState('10');
  const [experienceField, setExperienceField] = useState('totalExperience');
  const [band, setBand] = useState('2');
  const [colorBy, setColorBy] = useState('locationType');
  const [batchSort, setBatchSort] = useState('name');
  const [batchTop, setBatchTop] = useState('15');
  const [gridRows, setGridRows] = useState('employmentType');
  const [gridCols, setGridCols] = useState('region');

  const all = useMemo(() => applyFilters(people, filters), [people, filters]);
  const except = (field) => applyFiltersExcept(people, filters, field);

  const donutRows = except(donutBy);
  const donut = countBy(donutRows, donutBy);

  const subRows = except('subDivision');
  const subs = topWithOther(countBy(subRows, 'subDivision'), Number(subTop)).filter((entry) => entry.name !== 'Other');

  const designations = topWithOther(countBy(except('designation'), 'designation'), Number(designationTop));

  const regionRows = except('region');
  const regionBase = countBy(regionRows, 'region');
  const splitNames = regionSplit === 'none' ? [] : countBy(regionRows, regionSplit).slice(0, 6).map((entry) => entry.name);
  const regionData =
    regionSplit === 'none'
      ? regionBase
      : regionBase.map((entry) => {
          const inRegion = regionRows.filter((row) => labelOf(row.region) === entry.name);
          return Object.fromEntries([['name', entry.name], ...splitNames.map((name) => [name, countBy(inRegion, regionSplit).find((c) => c.name === name)?.value ?? 0])]);
        });

  const skills = topWithOther(countListBy(all, 'skills'), Number(skillTop)).filter((entry) => entry.name !== 'Other');

  const experience = histogram(all.map((row) => row[experienceField]), Number(band));

  const scatterGroups = useMemo(() => {
    const groups = new Map();
    for (const row of all) {
      if (row.kaarExperience === null || row.sapExperience === null) continue;
      const key = colorBy === 'none' ? 'All' : labelOf(row[colorBy]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ x: row.kaarExperience, y: row.sapExperience });
    }
    return [...groups].map(([name, points]) => ({ name, points }));
  }, [all, colorBy]);
  const scatterCount = scatterGroups.reduce((sum, group) => sum + group.points.length, 0);

  const batches = (() => {
    const counted = countBy(except('geBatch'), 'geBatch');
    const top = counted.slice(0, Number(batchTop));
    return batchSort === 'name' ? [...top].sort((a, b) => a.name.localeCompare(b.name)) : top;
  })();

  const grid = crossTab(all, gridRows, gridCols, 10, 8);

  const deployed = all.filter((row) => row.allocation > 0).length;
  const offshore = all.filter((row) => row.locationType === 'Offshore').length;

  return (
    <div className={styles.grid}>
      <ul className={`${styles.tiles} ${styles.wide}`} aria-label="Workforce totals">
        <li className={styles.tile}>
          <span className={styles.tileLabel}>Headcount</span>
          <span className={styles.tileValue}>
            <AnimatedNumber value={all.length} />
          </span>
        </li>
        <li className={styles.tile}>
          <span className={styles.tileLabel}>Offshore share</span>
          <span className={styles.tileValue}>{percent(offshore, all.length)}%</span>
        </li>
        <li className={styles.tile}>
          <span className={styles.tileLabel}>Deployed today</span>
          <span className={styles.tileValue}>{percent(deployed, all.length)}%</span>
        </li>
        <li className={styles.tile}>
          <span className={styles.tileLabel}>Average total experience (years)</span>
          <span className={styles.tileValue}>{oneDecimal(average(all.map((row) => row.totalExperience)))}</span>
        </li>
        <li className={styles.tile}>
          <span className={styles.tileLabel}>Average SAP experience (years)</span>
          <span className={styles.tileValue}>{oneDecimal(average(all.map((row) => row.sapExperience)))}</span>
        </li>
      </ul>

      <ChartCard
        title="Headcount split"
        columns={[DIMENSIONS.find((d) => d.value === donutBy).label, 'People']}
        rows={donut.map((entry) => [entry.name, entry.value])}
        controls={<ControlSelect label="Split by" value={donutBy} options={DIMENSIONS.filter((d) => d.value !== 'designation')} onChange={setDonutBy} />}
      >
        <DonutPie data={donut} activeName={filters[donutBy] ?? null} onPick={(name) => onToggle(donutBy, name)} total={formatCount(donutRows.length)} centerLabel="people" />
      </ChartCard>

      <ChartCard
        title="Headcount by sub division"
        columns={['Sub division', 'People']}
        rows={subs.map((entry) => [entry.name, entry.value])}
        controls={<ControlSelect label="Show top" value={subTop} options={['10', '20', '46']} onChange={setSubTop} />}
      >
        <TreemapChart data={subs} activeName={filters.subDivision ?? null} onPick={(name) => onToggle('subDivision', name)} />
      </ChartCard>

      <ChartCard
        title="Headcount by designation"
        columns={['Designation', 'People']}
        rows={designations.map((entry) => [entry.name, entry.value])}
        controls={<ControlSelect label="Show top" value={designationTop} options={TOP_OPTIONS} onChange={setDesignationTop} />}
      >
        <BarsChart sideways data={designations} activeName={filters.designation ?? null} onPick={(name) => name !== 'Other' && onToggle('designation', name)} />
      </ChartCard>

      <ChartCard
        title="Headcount by region"
        columns={['Region', ...(regionSplit === 'none' ? ['People'] : splitNames)]}
        rows={regionData.map((entry) => (regionSplit === 'none' ? [entry.name, entry.value] : [entry.name, ...splitNames.map((name) => entry[name])]))}
        controls={<ControlSelect label="Split by" value={regionSplit} options={[{ value: 'none', label: 'No split' }, ...DIMENSIONS.filter((d) => d.value !== 'region')]} onChange={setRegionSplit} />}
      >
        <BarsChart
          data={regionData}
          stacked={regionSplit !== 'none'}
          series={regionSplit === 'none' ? undefined : splitNames.map((name) => ({ key: name, label: name }))}
          activeName={filters.region ?? null}
          onPick={(name) => onToggle('region', name)}
        />
      </ChartCard>

      <ChartCard
        title="Skill mix"
        summary="Counts the first five skills listed for each person, once per person."
        columns={['Skill', 'People']}
        rows={skills.map((entry) => [entry.name, entry.value])}
        controls={<ControlSelect label="Show top" value={skillTop} options={TOP_OPTIONS} onChange={setSkillTop} />}
      >
        <BarsChart sideways data={skills} />
      </ChartCard>

      <ChartCard
        title="Experience bands"
        columns={['Years', 'People']}
        rows={experience.map((entry) => [entry.label, entry.value])}
        controls={
          <>
            <ControlSelect label="Measure" value={experienceField} options={EXPERIENCE_FIELDS} onChange={setExperienceField} />
            <ControlSelect label="Band width (years)" value={band} options={BAND_OPTIONS} onChange={setBand} />
          </>
        }
      >
        <BarsChart data={experience.map((entry) => ({ name: entry.label, value: entry.value }))} />
      </ChartCard>

      <ChartCard
        title="Kaar experience against SAP experience"
        summary={`${formatCount(scatterCount)} people with both figures.`}
        columns={['Group', 'Kaar years', 'SAP years']}
        rows={scatterGroups.flatMap((group) => group.points.slice(0, 200).map((point) => [group.name, point.x, point.y]))}
        controls={<ControlSelect label="Colour by" value={colorBy} options={[{ value: 'none', label: 'No colour' }, ...DIMENSIONS.filter((d) => d.value !== 'designation')]} onChange={setColorBy} />}
      >
        <ScatterPlot groups={scatterGroups} xLabel="Kaar experience (years)" yLabel="SAP experience (years)" />
      </ChartCard>

      <ChartCard
        title="Joining batches"
        columns={['GE batch', 'People']}
        rows={batches.map((entry) => [entry.name, entry.value])}
        controls={
          <>
            <ControlSelect label="Order" value={batchSort} options={[{ value: 'name', label: 'By batch name' }, { value: 'count', label: 'By size' }]} onChange={setBatchSort} />
            <ControlSelect label="Biggest batches" value={batchTop} options={['10', '15', '25', '48']} onChange={setBatchTop} />
          </>
        }
      >
        <BarsChart data={batches} activeName={filters.geBatch ?? null} onPick={(name) => onToggle('geBatch', name)} />
      </ChartCard>

      <ChartCard
        wide
        title="Two-way headcount grid"
        columns={['Row', ...grid.colNames]}
        rows={grid.rowNames.map((rowName) => [rowName, ...grid.colNames.map((colName) => grid.cell(rowName, colName))])}
        controls={
          <>
            <ControlSelect label="Rows" value={gridRows} options={DIMENSIONS} onChange={setGridRows} />
            <ControlSelect label="Columns" value={gridCols} options={DIMENSIONS} onChange={setGridCols} />
          </>
        }
      >
        <Heatmap
          rowLabel={DIMENSIONS.find((d) => d.value === gridRows).label}
          rowNames={grid.rowNames}
          colNames={grid.colNames}
          cell={grid.cell}
          onPick={(rowName, colName) => {
            onSet(gridRows, rowName);
            onSet(gridCols, colName);
          }}
        />
      </ChartCard>
    </div>
  );
}

WorkforceTab.propTypes = {
  people: PropTypes.arrayOf(PropTypes.object).isRequired,
  filters: PropTypes.objectOf(PropTypes.string).isRequired,
  onToggle: PropTypes.func.isRequired,
  onSet: PropTypes.func.isRequired,
};

export default WorkforceTab;
