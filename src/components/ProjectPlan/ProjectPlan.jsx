import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  PLAN_GROUPS,
  PLAN_MONTHS,
  PLAN_OWNER,
  PLAN_START_DATE,
  PLAN_WEEK_COUNT,
  STATUS,
} from '../../data/projectPlan';
import { effectivePoc, isBehindPlan, shortDate, weekOf, weekRangeLabel, weekStart } from '../../lib/projectPlanCalendar';
import { fetchPlanActuals } from '../../lib/projectPlanApi';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import ActualDialog from './ActualDialog';
import styles from './ProjectPlan.module.css';

// View of the locked project plan (src/data/projectPlan.js): the owner's
// activities, statuses, week bars and percentages exactly as supplied, with
// calendar dates under the weeks, a today marker, percent-complete shading, a
// status filter, a behind-plan flag, and the recorded actual progress drawn as
// a bar under each planned bar. Nothing here edits the plan; actuals are kept
// separately (backend /v1/project-plan/actuals).

const WEEKS = Array.from({ length: PLAN_WEEK_COUNT }, (_, index) => index + 1);
const ALL = 'All';
const FILTERS = [ALL, ...Object.values(STATUS)];

const STATUS_CLASS = {
  [STATUS.COMPLETED]: styles.completed,
  [STATUS.IN_PROGRESS]: styles.inProgress,
  [STATUS.YET_TO_START]: styles.yetToStart,
};

function pocClass(poc) {
  if (poc >= 100) return styles.pocDone;
  if (poc > 0) return styles.pocPartial;
  return styles.pocNone;
}

// How much of a cell on a bar is "done": the bar is filled from its left end
// in proportion to the percentage complete.
function shadeFraction(row, week) {
  const length = row.endWeek - row.startWeek + 1;
  const done = (row.poc / 100) * length - (week - row.startWeek);
  return Math.min(1, Math.max(0, done));
}

// The weeks an actual bar covers. A start with no end runs up to the current
// week (never before its own start).
function actualRange(actual, currentWeek) {
  if (!actual || actual.actualStartWeek == null) return null;
  const end = actual.actualEndWeek ?? Math.min(PLAN_WEEK_COUNT, Math.max(actual.actualStartWeek, currentWeek));
  return [actual.actualStartWeek, end];
}

function WeekCells({ row, actual, currentWeek }) {
  const range = actualRange(actual, currentWeek);
  return WEEKS.map((week) => {
    const inBar = week >= row.startWeek && week <= row.endWeek;
    const inActual = range !== null && week >= range[0] && week <= range[1];
    const shade = inBar ? shadeFraction(row, week) : 0;
    return (
      <td
        key={week}
        className={`${styles.weekCell} ${inBar ? STATUS_CLASS[row.status] : ''} ${week === currentWeek ? styles.today : ''}`}
        title={inBar ? `${row.status}: Week ${row.startWeek} to Week ${row.endWeek}` : undefined}
      >
        {shade > 0 && <span className={styles.shade} style={{ width: `${shade * 100}%` }} />}
        {inActual && <span className={styles.actualBar} title={`Actual: Week ${range[0]} to Week ${range[1]}`} />}
      </td>
    );
  });
}

WeekCells.propTypes = {
  row: PropTypes.object.isRequired,
  actual: PropTypes.object,
  currentWeek: PropTypes.number.isRequired,
};

function ProjectPlan({ today = new Date(), readOnly = false }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [filter, setFilter] = useState(ALL);
  const [editing, setEditing] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const { data: actuals, error } = useAsyncResource(fetchPlanActuals, [reloadToken]);
  const byKey = actuals ?? {};

  const currentWeek = weekOf(today);
  const hasStarted = currentWeek >= 1;
  const isOver = currentWeek > PLAN_WEEK_COUNT;

  const behindCount = PLAN_GROUPS.flatMap((group) => [
    [group, group.slNo],
    ...group.items.map((item) => [item, `${group.slNo.charAt(0)}${item.slNo}`]),
  ]).filter(([row, key]) => isBehindPlan(row, byKey[key], currentWeek)).length;

  function toggle(slNo) {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(slNo)) next.delete(slNo);
      else next.add(slNo);
      return next;
    });
  }

  const matches = (row) => filter === ALL || row.status === filter;

  function renderRow(row, key, { isGroup = false } = {}) {
    const actual = byKey[key];
    const behind = isBehindPlan(row, actual, currentWeek);
    const poc = effectivePoc(row, actual);
    return (
      <tr key={key} className={`${isGroup ? styles.groupRow : ''} ${behind ? styles.behind : ''}`}>
        <td className={styles.colSl}>{row.slNo}</td>
        <td className={styles.colCategory}>{row.category}</td>
        <td className={`${styles.colActivity} ${isGroup ? styles.groupTitle : ''}`}>
          {isGroup ? (
            <button type="button" className={styles.groupToggle} aria-expanded={!collapsed.has(row.slNo)} onClick={() => toggle(row.slNo)}>
              <span aria-hidden="true">{collapsed.has(row.slNo) ? '▸' : '▾'}</span>
              <span>{row.activity}</span>
            </button>
          ) : (
            row.activity
          )}
        </td>
        <td className={`${styles.colStatus} ${STATUS_CLASS[row.status]}`}>{row.status}</td>
        <WeekCells row={row} actual={actual} currentWeek={currentWeek} />
        <td className={styles.colActual}>
          <span className={styles.actualText}>{actual ? `${actual.actualPoc}%` : 'No actual'}</span>
          {behind && <span className={styles.behindBadge}>Behind plan</span>}
          {!readOnly && (
            <button type="button" className={styles.actualButton} onClick={() => setEditing({ row, key })}>
              {actual ? 'Edit actual' : 'Record actual'}
            </button>
          )}
        </td>
        <td className={`${styles.poc} ${pocClass(poc)}`} title={actual ? 'Actual percent complete' : 'Percent complete on the plan sheet'}>
          {poc}%
        </td>
      </tr>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="Filter by status">
          {FILTERS.map((name) => (
            <button key={name} type="button" className={styles.filter} aria-pressed={filter === name} onClick={() => setFilter(name)}>
              {name}
            </button>
          ))}
        </div>
        <p className={styles.todayNote} role="status">
          {!hasStarted
            ? `The plan starts on ${shortDate(weekStart(1))} ${PLAN_START_DATE.slice(0, 4)}.`
            : isOver
              ? `The plan's ${PLAN_WEEK_COUNT} weeks have ended.`
              : `Today is in Week ${currentWeek} (${weekRangeLabel(currentWeek)}).`}
          {' '}
          {behindCount === 0 ? 'Nothing is behind plan.' : `${behindCount} ${behindCount === 1 ? 'row is' : 'rows are'} behind plan.`}
        </p>
      </div>

      <ul className={styles.legend} aria-label="Colour key">
        {Object.values(STATUS).map((status) => (
          <li key={status} className={styles.legendItem}>
            <span className={`${styles.swatch} ${STATUS_CLASS[status]}`} aria-hidden="true" />
            {status}
          </li>
        ))}
        <li className={styles.legendItem}><span className={`${styles.swatch} ${styles.swatchShade}`} aria-hidden="true" />Percent complete</li>
        <li className={styles.legendItem}><span className={`${styles.swatch} ${styles.swatchActual}`} aria-hidden="true" />Actual</li>
        <li className={styles.legendItem}><span className={`${styles.swatch} ${styles.swatchToday}`} aria-hidden="true" />Today</li>
      </ul>

      {error && (
        <p className={styles.error} role="alert">
          The actual progress could not be loaded: {error.message}
        </p>
      )}

      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th rowSpan={2} className={`${styles.head} ${styles.colSl}`}>Sl. No</th>
              <th rowSpan={2} className={`${styles.head} ${styles.colCategory}`}>Category</th>
              <th rowSpan={2} className={`${styles.head} ${styles.colActivity}`}>Activity</th>
              <th rowSpan={2} className={`${styles.head} ${styles.colStatus}`}>Status</th>
              {PLAN_MONTHS.map((month) => (
                <th key={`${month.label}-${month.firstWeek}`} colSpan={month.lastWeek - month.firstWeek + 1} className={styles.monthHead}>
                  {month.label}
                </th>
              ))}
              <th rowSpan={2} className={`${styles.head} ${styles.colActual}`}>Actual</th>
              <th rowSpan={2} className={`${styles.head} ${styles.colPoc}`}>POC</th>
            </tr>
            <tr>
              {WEEKS.map((week) => (
                <th key={week} className={`${styles.weekHead} ${week === currentWeek ? styles.todayHead : ''}`} title={weekRangeLabel(week)}>
                  <span className={styles.weekLabel}>
                    Week {week} · {shortDate(weekStart(week))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className={styles.ownerRow}>
              <td colSpan={4 + PLAN_WEEK_COUNT + 1} className={styles.ownerLabel}>
                {PLAN_OWNER.label}
              </td>
              <td className={`${styles.poc} ${pocClass(PLAN_OWNER.poc)}`}>{PLAN_OWNER.poc}%</td>
            </tr>
            {PLAN_GROUPS.map((group) => {
              const shownItems = group.items.filter(matches);
              if (filter !== ALL && !matches(group) && shownItems.length === 0) return null;
              return [
                renderRow(group, group.slNo, { isGroup: true }),
                ...(collapsed.has(group.slNo) ? [] : shownItems.map((item) => renderRow(item, `${group.slNo.charAt(0)}${item.slNo}`))),
              ];
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <ActualDialog
          row={{ ...editing.row, slNo: editing.key }}
          actual={byKey[editing.key]}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setReloadToken((token) => token + 1);
          }}
        />
      )}
    </div>
  );
}

ProjectPlan.propTypes = {
  today: PropTypes.instanceOf(Date),
  readOnly: PropTypes.bool,
};

export default ProjectPlan;
