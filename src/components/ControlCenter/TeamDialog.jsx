import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTeamDetail } from '../../hooks/useTeamDetail';
import { formatHours, STATUS_LABELS } from '../../lib/hours';
import { formatDay, formatUsd } from '../../lib/money';
import { MASTER_DATA_TABLES } from '../../lib/masterDataApi';
import { formatMonth } from '../../lib/months';
import RecordFormModal from '../RecordFormModal';
import { todayIso, unassignSeat } from '../../lib/teamActions';
import AssignSeatForm from './AssignSeatForm';
import DeleteAssignmentForm from './DeleteAssignmentForm';
import { statusClass } from './statusClass';
import styles from './ControlCenter.module.css';

const percent = (value) => (value === null ? '—' : `${value}%`);

const ASSIGNMENTS_TABLE = MASTER_DATA_TABLES.find((table) => table.route === 'project-assignments');
const ASSIGNMENT_LABELS = Object.fromEntries(ASSIGNMENTS_TABLE.columns.map((column) => [column.key, column.label]));
const LOCATIONS = ['Onsite', 'Offshore', 'Hybrid'];

// The row the Edit form opens on: the field names the Project Assignments table uses.
const assignmentRecord = (teamCode, assignment) => ({
  id: assignment.id,
  projectId: assignment.projectId,
  teamId: teamCode,
  projectAssignmentStartDate: assignment.start,
  projectAssignmentEndDate: assignment.end,
});
const LOCATION_CLASS = { Onsite: styles.dotOnsite, Offshore: styles.dotOffshore, Hybrid: styles.dotHybrid };

function CostCell({ value }) {
  return <td className={styles.numeric}>{formatUsd(value)}</td>;
}

CostCell.propTypes = { value: PropTypes.number };

// One bar per month. `pending` months have no assignment, so the panel shows a
// message and a zero total instead.
function MonthPanel({ title, hasAssignment, rows, total, mix }) {
  const headingId = `panel-${title.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <section className={styles.sidePanel} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.dialogHeading}>
        {title}
      </h3>
      {!hasAssignment ? (
        <p className={styles.dialogLine}>No live project assignment</p>
      ) : (
        <ul className={styles.monthList}>
          {rows.map((row) => (
            <li key={row.month} className={styles.monthRow}>
              <span className={styles.monthName}>{row.label}</span>
              <span className={`${styles.monthDot} ${mix ? LOCATION_CLASS[mix] : ''}`} aria-hidden="true" />
              <span className={styles.monthTrack} aria-hidden="true">
                <span className={styles.monthFill} style={{ width: `${row.fill}%` }} />
              </span>
              <span className={styles.monthValue}>{row.text}</span>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.monthTotal}>{total}</p>
    </section>
  );
}

MonthPanel.propTypes = {
  title: PropTypes.string.isRequired,
  hasAssignment: PropTypes.bool.isRequired,
  rows: PropTypes.arrayOf(
    PropTypes.shape({ month: PropTypes.string, label: PropTypes.string, fill: PropTypes.number, text: PropTypes.string }),
  ).isRequired,
  total: PropTypes.string.isRequired,
  mix: PropTypes.string,
};

// One seat: its row, and under a vacant seat the Assign form when it is open.
function SeatRows({ seat, seats, assigning, busy, onAssign, onCancelAssign, onUnassign, onSaved }) {
  const vacant = seat.employeeId === null;
  return (
    <>
      <tr className={vacant ? styles.vacantRow : undefined}>
        <th scope="row">
          {seat.positionName}
          <span className={styles.rowMeta}>
            {seat.positionCode}
            {seat.counted ? '' : ', not counted in the team'}
          </span>
        </th>
        <td>
          {seat.employeeName ?? 'Vacant'}
          {vacant && (
            <button type="button" className={styles.seatButton} onClick={onAssign} disabled={assigning}>
              Assign
            </button>
          )}
          {!vacant && seat.deploymentId && (
            <button type="button" className={styles.seatButton} onClick={onUnassign} disabled={busy}>
              Unassign
            </button>
          )}
        </td>
        <td className={styles.numeric}>{percent(seat.allocationPercentage)}</td>
        <td className={styles.numeric}>{percent(seat.availablePercentage)}</td>
        <CostCell value={seat.plannedResourceCost} />
        <CostCell value={seat.actualResourceCost} />
        <td className={styles.numeric}>
          {formatUsd(seat.allocatedResourceCost)}
          {seat.costSource && <span className={styles.sourceTag}>{seat.costSource}</span>}
        </td>
      </tr>
      {assigning && (
        <tr>
          <td colSpan={7}>
            <AssignSeatForm seat={seat} seats={seats} onCancel={onCancelAssign} onSaved={onSaved} />
          </td>
        </tr>
      )}
    </>
  );
}

const seatShape = PropTypes.shape({
  positionCode: PropTypes.string.isRequired,
  positionName: PropTypes.string.isRequired,
  counted: PropTypes.bool,
  employeeId: PropTypes.number,
  employeeName: PropTypes.string,
  deploymentId: PropTypes.string,
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  allocationPercentage: PropTypes.number,
  availablePercentage: PropTypes.number,
  plannedResourceCost: PropTypes.number,
  actualResourceCost: PropTypes.number,
  allocatedResourceCost: PropTypes.number,
  costSource: PropTypes.string,
});

SeatRows.propTypes = {
  seat: seatShape.isRequired,
  seats: PropTypes.arrayOf(seatShape).isRequired,
  assigning: PropTypes.bool.isRequired,
  busy: PropTypes.bool.isRequired,
  onAssign: PropTypes.func.isRequired,
  onCancelAssign: PropTypes.func.isRequired,
  onUnassign: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

// `pageError` is the page's own refresh failure: the popup is refetched from
// the page's refreshes, so while those fail it must not claim to be live.
function TeamDialog({ code, month, updatedAt, pageError, onClose }) {
  const [reloads, setReloads] = useState(0);
  // null, { mode: 'add' } or { mode: 'edit', record }. The record is taken when the
  // form opens, so a refetch cannot change which assignment an open form saves to.
  const [form, setForm] = useState(null);
  // Inline forms in the popup: the position code of the vacant seat being
  // assigned, and whether the Delete Project Assignment form is open.
  const [assigning, setAssigning] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [seatBusy, setSeatBusy] = useState(false);
  const [seatError, setSeatError] = useState(null);
  const { data: team, isLoading, error } = useTeamDetail(code, month, `${updatedAt.getTime()}-${reloads}`);
  const closeRef = useRef(null);

  // Focus moves into the dialog on open and back to the card that opened it.
  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  // Escape closes the form first when one is open, then the popup.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (form) setForm(null);
      else if (assigning || deleting) {
        setAssigning(null);
        setDeleting(false);
      } else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, form, assigning, deleting]);

  const reload = () => setReloads((n) => n + 1);
  const projects = team?.projects ?? [];
  const current = projects[0] ?? null;

  const unassign = async (seat) => {
    setSeatBusy(true);
    setSeatError(null);
    try {
      await unassignSeat(seat, todayIso());
      reload();
    } catch (err) {
      setSeatError(err);
    } finally {
      setSeatBusy(false);
    }
  };
  // An older backend (frontend and backend deploy separately) sends no plan.
  const plan = team?.monthlyPlan ?? { months: [], totalCost: 0 };
  const maxCost = Math.max(1, ...plan.months.map((m) => m.cost));

  // The form is a sibling of the popup's overlay, not a child, so a click on
  // the form's own backdrop cannot also close the popup.
  return (
    <>
      <div className={styles.overlay} role="presentation" onClick={onClose}>
        <div
          className={`${styles.dialog} ${styles.dialogWide}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-dialog-title"
          onClick={(e) => e.stopPropagation()}
        >
          <header className={styles.dialogHead}>
            <div>
              <h2 id="team-dialog-title" className={styles.dialogTitle}>
                {team ? team.name : code}
              </h2>
              <p className={styles.dialogSub}>
                {team ? `${team.code}, ${team.department.name ?? team.department.code}` : code} · {formatMonth(month)}
              </p>
            </div>
            <div className={styles.dialogActions}>
              {team && (
                <button
                  type="button"
                  className={styles.addAssignment}
                  onClick={() => (current ? setDeleting(true) : setForm({ mode: 'add' }))}
                >
                  {current ? 'Delete Project Assignment' : 'Add Project Assignment'}
                </button>
              )}
              <button ref={closeRef} type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>
          </header>

          {!team && isLoading ? (
            <p role="status" aria-live="polite">
              Loading…
            </p>
          ) : !team ? (
            <p className={styles.statusError} role="alert">
              Could not load the team: {error.message}
            </p>
          ) : (
            <>
              {error || pageError ? (
                <p className={styles.statusError} role="alert">
                  Could not refresh, showing the last data: {(error ?? pageError).message}
                </p>
              ) : (
                <p className={styles.dialogLive} role="status" aria-live="polite">
                  <span className={isLoading ? styles.liveDotBusy : styles.liveDot} aria-hidden="true" />
                  {isLoading ? 'Updating…' : `Live, updated ${updatedAt.toLocaleTimeString('en-GB')}`}
                </p>
              )}
              <ul
                key={`${team.availableHours}-${team.allocatedHours}-${team.utilizedHours}`}
                className={`${styles.dialogStats} ${styles.dialogStatsFlash}`}
              >
                <li>
                  <span className={styles.hoursLabel}>Available</span>
                  <span className={styles.statValue}>{formatHours(team.availableHours)}</span>
                </li>
                <li>
                  <span className={styles.hoursLabel}>Allocated</span>
                  <span className={styles.statValue}>{formatHours(team.allocatedHours)}</span>
                </li>
                <li>
                  <span className={styles.hoursLabel}>Planned utilization</span>
                  <span className={styles.statValue}>{formatHours(team.utilizedHours)}</span>
                </li>
                <li>
                  <span className={styles.hoursLabel}>Allocated Team Cost</span>
                  <span className={styles.statValue}>{formatUsd(team.allocatedTeamCost)}</span>
                  {team.defaultedCostCount > 0 && (
                    <span className={styles.rowMeta}>
                      {team.defaultedCostCount} {team.defaultedCostCount === 1 ? 'person' : 'people'} costed at the default rate
                    </span>
                  )}
                </li>
                <li className={`${styles.statusPill} ${statusClass(styles, team.status)}`}>{STATUS_LABELS[team.status]}</li>
              </ul>

              {team.competencies.length > 0 && <p className={styles.dialogLine}>Competencies: {team.competencies.join(', ')}</p>}

              <div className={styles.dialogBody}>
                <div className={styles.dialogMain}>
                  <h3 className={styles.dialogHeading}>Projects</h3>
                  {!current ? (
                    <p className={styles.dialogLine}>No assignment</p>
                  ) : (
                    <ul className={styles.projectList}>
                      {projects.map((project) => (
                        <li key={project.id} className={styles.projectRow}>
                          <div>
                            <strong className={styles.projectName}>{project.projectName ?? project.projectId}</strong>
                            {project.projectName && <span className={styles.projectCode}>{project.projectId}</span>}
                            <span className={styles.projectDates}>
                              {formatDay(project.start)} to {formatDay(project.end)}
                            </span>
                          </div>
                          <button
                            type="button"
                            className={styles.editAssignment}
                            onClick={() => setForm({ mode: 'edit', record: assignmentRecord(team.code, project) })}
                          >
                            Edit
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {deleting && current && (
                    <DeleteAssignmentForm
                      key={current.id}
                      project={current}
                      onCancel={() => setDeleting(false)}
                      onSaved={() => {
                        setDeleting(false);
                        reload();
                      }}
                    />
                  )}

                  {team.nextAssignment?.start && (
                    <p className={styles.dialogLine}>
                      Next assignment: {team.nextAssignment.projectName ?? team.nextAssignment.projectId}, {formatDay(team.nextAssignment.start)} to{' '}
                      {formatDay(team.nextAssignment.end)}
                    </p>
                  )}

                  <h3 className={styles.dialogHeading}>Positions and people</h3>
                  {seatError && (
                    <p className={styles.statusError} role="alert">
                      Could not unassign: {seatError.message}
                    </p>
                  )}
                  <div className={styles.tableScroll}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th scope="col">Position</th>
                          <th scope="col">Person</th>
                          <th scope="col" className={styles.numeric}>
                            Allocation
                          </th>
                          <th scope="col" className={styles.numeric}>
                            Available
                          </th>
                          <th scope="col" className={styles.numeric}>
                            Planned Resource Cost
                          </th>
                          <th scope="col" className={styles.numeric}>
                            Actual Resource Cost
                          </th>
                          <th scope="col" className={styles.numeric}>
                            Allocated Resource Cost
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {team.seats.map((seat) => (
                          <SeatRows
                            key={`${seat.positionCode}-${seat.employeeId ?? 'vacant'}`}
                            seat={seat}
                            seats={team.seats}
                            assigning={assigning === seat.positionCode}
                            busy={seatBusy}
                            onAssign={() => setAssigning(seat.positionCode)}
                            onCancelAssign={() => setAssigning(null)}
                            onUnassign={() => unassign(seat)}
                            onSaved={() => {
                              setAssigning(null);
                              reload();
                            }}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <aside className={styles.dialogSide}>
                  <MonthPanel
                    title="Month-wise Utilization Percentage"
                    hasAssignment={plan.months.length > 0}
                    mix={team.locationMix}
                    rows={plan.months.map((m) => ({
                      month: m.month,
                      label: formatMonth(m.month),
                      fill: m.utilizationPercent,
                      text: `${m.utilizationPercent}%`,
                    }))}
                    total={current ? `Assignment ends ${formatDay(projects.at(-1).end)}` : 'Planned utilization 0%'}
                  />
                  <MonthPanel
                    title="Month-wise Utilization Cost"
                    hasAssignment={plan.months.length > 0}
                    mix={team.locationMix}
                    rows={plan.months.map((m) => ({
                      month: m.month,
                      label: formatMonth(m.month),
                      fill: (m.cost / maxCost) * 100,
                      text: formatUsd(m.cost),
                    }))}
                    total={`Total ${formatUsd(plan.totalCost)}`}
                  />
                  <ul className={styles.locationLegend} aria-label="Location of the people deployed">
                    {LOCATIONS.map((name) => (
                      <li key={name} className={team.locationMix === name ? styles.legendActive : undefined}>
                        <span className={`${styles.monthDot} ${LOCATION_CLASS[name]}`} aria-hidden="true" />
                        {name}
                      </li>
                    ))}
                  </ul>
                </aside>
              </div>
            </>
          )}
        </div>
      </div>

      {form && team && (
        <RecordFormModal
          key={form.mode}
          route="project-assignments"
          singularLabel="Project Assignment"
          labelByKey={ASSIGNMENT_LABELS}
          record={form.record}
          initialValues={{ teamId: team.code, projectAssignmentStartDate: todayIso() }}
          lockedKeys={['teamId']}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            reload();
          }}
        />
      )}
    </>
  );
}

TeamDialog.propTypes = {
  code: PropTypes.string.isRequired,
  month: PropTypes.string.isRequired,
  updatedAt: PropTypes.instanceOf(Date).isRequired,
  pageError: PropTypes.instanceOf(Error),
  onClose: PropTypes.func.isRequired,
};

export default TeamDialog;
