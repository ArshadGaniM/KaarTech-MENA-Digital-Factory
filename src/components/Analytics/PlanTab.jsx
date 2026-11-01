import { useState } from 'react';
import PropTypes from 'prop-types';
import { PLAN_GROUPS, PLAN_WEEK_COUNT, STATUS } from '../../data/initiativePlan';
import { usePlanActuals } from '../../hooks/useAnalyticsData';
import { effectivePoc, isBehindPlan, weekOf } from '../../lib/initiativePlanCalendar';
import ChartCard from './ChartCard';
import ControlSelect from './Controls';
import LoadGate from './LoadGate';
import { BarsChart, DonutPie, TrendChart } from './charts';
import styles from './Analytics.module.css';

// "1.0" has activities "a" to "i", whose actual progress is stored under "1a".
const keyOf = (group, item) => `${group.slNo.slice(0, group.slNo.indexOf('.'))}${item.slNo}`;
const shortName = (text) => (text.length > 44 ? `${text.slice(0, 43)}…` : text);
const STATUS_ORDER = [STATUS.COMPLETED, STATUS.IN_PROGRESS, STATUS.YET_TO_START];
const STATUS_COLORS = { [STATUS.COMPLETED]: 'var(--color-plan-completed)', [STATUS.IN_PROGRESS]: 'var(--color-plan-progress)', [STATUS.YET_TO_START]: 'var(--color-plan-pending)' };
const average = (values) => (values.length === 0 ? 0 : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10);

// Planned progress of one activity in a week: nothing before it starts, linear
// across its bar, done after it ends.
const plannedProgress = (item, week) => (week < item.startWeek ? 0 : week >= item.endWeek ? 100 : ((week - item.startWeek + 1) / (item.endWeek - item.startWeek + 1)) * 100);

function Charts({ actuals, currentWeek }) {
  const [group46, setGroup46] = useState('all');
  const [group48, setGroup48] = useState('all');
  const [group50, setGroup50] = useState('all');

  const items = PLAN_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, group: group.slNo, key: keyOf(group, item), actual: actuals[keyOf(group, item)] ?? null })));
  const groupOptions = [{ value: 'all', label: 'All groups' }, ...PLAN_GROUPS.map((group) => ({ value: group.slNo, label: `${group.slNo} ${shortName(group.activity)}` }))];
  const within = (group) => items.filter((item) => group === 'all' || item.group === group);

  // 46: how long each activity was planned to take and how long it has taken.
  const durations = within(group46).map((item) => ({
    name: `${item.key} ${shortName(item.activity)}`,
    Planned: item.endWeek - item.startWeek + 1,
    Actual: item.actual && item.actual.actualStartWeek != null && item.actual.actualEndWeek != null ? item.actual.actualEndWeek - item.actual.actualStartWeek + 1 : 0,
  }));

  // 47: how far each group has got.
  const groups = PLAN_GROUPS.map((group) => ({ name: `${group.slNo} ${shortName(group.activity)}`, 'On the sheet': group.poc, Recorded: effectivePoc(group, actuals[group.slNo] ?? null) }));

  // 48: the activities that are behind plan.
  const behind = within(group48)
    .filter((item) => isBehindPlan(item, item.actual, currentWeek))
    .map((item) => [`${item.key} ${shortName(item.activity)}`, item.endWeek, item.status, effectivePoc(item, item.actual), Math.max(0, currentWeek - item.endWeek)]);

  // 49: planned progress by week, against the progress recorded so far.
  const weeks = Array.from({ length: PLAN_WEEK_COUNT }, (_, i) => i + 1).map((week) => ({
    label: `W${week}`,
    planned: average(items.map((item) => plannedProgress(item, week))),
    recorded: week === currentWeek ? average(items.map((item) => effectivePoc(item, item.actual))) : null,
  }));

  // 50: how many activities are in each state.
  const statuses = STATUS_ORDER.map((status) => ({ name: status, value: within(group50).filter((item) => item.status === status).length })).filter((entry) => entry.value > 0);

  return (
    <div className={styles.grid}>
      <ChartCard
        wide
        title="Weeks planned against weeks taken"
        summary="Weeks taken come from the actual start and end you record. An activity with none shows 0."
        columns={['Activity', 'Planned weeks', 'Weeks taken']}
        rows={durations.map((entry) => [entry.name, entry.Planned, entry.Actual])}
        controls={<ControlSelect label="Group" value={group46} options={groupOptions} onChange={setGroup46} />}
      >
        <BarsChart sideways data={durations} series={[{ key: 'Planned', label: 'Planned weeks' }, { key: 'Actual', label: 'Weeks taken' }]} />
      </ChartCard>

      <ChartCard
        title="Percent complete by group"
        summary="The sheet's figure, and the recorded figure where one exists."
        columns={['Group', 'On the sheet', 'Recorded']}
        rows={groups.map((entry) => [entry.name, entry['On the sheet'], entry.Recorded])}
      >
        <BarsChart sideways data={groups} series={[{ key: 'On the sheet', label: 'On the sheet' }, { key: 'Recorded', label: 'Recorded' }]} />
      </ChartCard>

      <ChartCard
        title="Plan progress by week"
        summary={currentWeek >= 1 ? `This is week ${currentWeek}. The recorded line is one point, since progress is not stored week by week.` : 'The plan has not started yet.'}
        columns={['Week', 'Planned %', 'Recorded %']}
        rows={weeks.map((entry) => [entry.label, entry.planned, entry.recorded ?? '–'])}
      >
        <TrendChart data={weeks} lines={[{ key: 'planned', label: 'Planned', right: true }, { key: 'recorded', label: 'Recorded', right: true }]} percentAxis />
      </ChartCard>

      <ChartCard
        tableOnly
        title="Activities behind plan"
        summary={currentWeek >= 1 ? `As of week ${currentWeek}.` : 'The plan has not started yet.'}
        columns={['Activity', 'Planned end week', 'Status', 'Complete %', 'Weeks late']}
        rows={behind}
        controls={<ControlSelect label="Group" value={group48} options={groupOptions} onChange={setGroup48} />}
      />

      <ChartCard
        title="Activities by status"
        columns={['Status', 'Activities']}
        rows={statuses.map((entry) => [entry.name, entry.value])}
        controls={<ControlSelect label="Group" value={group50} options={groupOptions} onChange={setGroup50} />}
      >
        <DonutPie data={statuses} colors={STATUS_COLORS} total={String(within(group50).length)} centerLabel="activities" />
      </ChartCard>
    </div>
  );
}

Charts.propTypes = {
  actuals: PropTypes.objectOf(PropTypes.object).isRequired,
  currentWeek: PropTypes.number.isRequired,
};

// The initiative plan visuals. The plan itself is read-only here, as everywhere.
function PlanTab({ refreshKey }) {
  const [retries, setRetries] = useState(0);
  const result = usePlanActuals(refreshKey + retries);

  return (
    <div className={styles.page}>
      <LoadGate results={[result]} what="the plan progress" onRetry={() => setRetries((count) => count + 1)}>
        <Charts actuals={result.data?.actuals ?? {}} currentWeek={weekOf(new Date())} />
      </LoadGate>
    </div>
  );
}

PlanTab.propTypes = { refreshKey: PropTypes.number.isRequired };

export default PlanTab;
