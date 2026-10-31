import { useState } from 'react';
import {
  PLAN_GROUPS,
  PLAN_MONTHS,
  PLAN_OWNER,
  PLAN_WEEK_COUNT,
  STATUS,
} from '../../data/projectPlan';
import styles from './ProjectPlan.module.css';

// Read-only view of the locked project plan (src/data/projectPlan.js): the
// owner's activities, statuses, week bars and percentages exactly as supplied.
// Nothing here edits the plan, and the plan is not fetched from anywhere, so
// it cannot drift. Plan-versus-actual tracking will sit beside it later.

const WEEKS = Array.from({ length: PLAN_WEEK_COUNT }, (_, index) => index + 1);

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

function WeekCells({ row }) {
  return WEEKS.map((week) => {
    const inBar = week >= row.startWeek && week <= row.endWeek;
    return (
      <td
        key={week}
        className={`${styles.weekCell} ${inBar ? STATUS_CLASS[row.status] : ''}`}
        title={inBar ? `${row.status}: Week ${row.startWeek} to Week ${row.endWeek}` : undefined}
      />
    );
  });
}

function ProjectPlan() {
  const [collapsed, setCollapsed] = useState(() => new Set());

  function toggle(slNo) {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(slNo)) next.delete(slNo);
      else next.add(slNo);
      return next;
    });
  }

  return (
    <div className={styles.wrapper}>
      <ul className={styles.legend} aria-label="Status colours">
        {Object.values(STATUS).map((status) => (
          <li key={status} className={styles.legendItem}>
            <span className={`${styles.swatch} ${STATUS_CLASS[status]}`} aria-hidden="true" />
            {status}
          </li>
        ))}
      </ul>

      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th rowSpan={2} className={`${styles.head} ${styles.colSl}`}>Sl. No</th>
              <th rowSpan={2} className={`${styles.head} ${styles.colCategory}`}>Category</th>
              <th rowSpan={2} className={`${styles.head} ${styles.colActivity}`}>Activity</th>
              <th rowSpan={2} className={`${styles.head} ${styles.colStatus}`}>Status</th>
              {PLAN_MONTHS.map((month) => (
                <th
                  key={`${month.label}-${month.firstWeek}`}
                  colSpan={month.lastWeek - month.firstWeek + 1}
                  className={styles.monthHead}
                >
                  {month.label}
                </th>
              ))}
              <th rowSpan={2} className={`${styles.head} ${styles.colPoc}`}>POC</th>
            </tr>
            <tr>
              {WEEKS.map((week) => (
                <th key={week} className={styles.weekHead}>
                  <span className={styles.weekLabel}>Week {week}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className={styles.ownerRow}>
              <td colSpan={4 + PLAN_WEEK_COUNT} className={styles.ownerLabel}>
                {PLAN_OWNER.label}
              </td>
              <td className={`${styles.poc} ${pocClass(PLAN_OWNER.poc)}`}>{PLAN_OWNER.poc}%</td>
            </tr>
            {PLAN_GROUPS.map((group) => {
              const isCollapsed = collapsed.has(group.slNo);
              return [
                <tr key={group.slNo} className={styles.groupRow}>
                  <td className={styles.colSl}>{group.slNo}</td>
                  <td className={styles.colCategory}>{group.category}</td>
                  <td className={`${styles.colActivity} ${styles.groupTitle}`}>
                    <button
                      type="button"
                      className={styles.groupToggle}
                      aria-expanded={!isCollapsed}
                      onClick={() => toggle(group.slNo)}
                    >
                      <span aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
                      <span>{group.activity}</span>
                    </button>
                  </td>
                  <td className={`${styles.colStatus} ${STATUS_CLASS[group.status]}`}>{group.status}</td>
                  <WeekCells row={group} />
                  <td className={`${styles.poc} ${pocClass(group.poc)}`}>{group.poc}%</td>
                </tr>,
                ...(isCollapsed
                  ? []
                  : group.items.map((item) => (
                      <tr key={`${group.slNo}${item.slNo}`}>
                        <td className={styles.colSl}>{item.slNo}</td>
                        <td className={styles.colCategory}>{item.category}</td>
                        <td className={styles.colActivity}>{item.activity}</td>
                        <td className={`${styles.colStatus} ${STATUS_CLASS[item.status]}`}>{item.status}</td>
                        <WeekCells row={item} />
                        <td className={`${styles.poc} ${pocClass(item.poc)}`}>{item.poc}%</td>
                      </tr>
                    ))),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProjectPlan;
