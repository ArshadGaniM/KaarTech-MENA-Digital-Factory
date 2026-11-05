import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTeamDetail } from '../../hooks/useTeamDetail';
import { formatHours, STATUS_LABELS } from '../../lib/hours';
import { formatDay, formatUsd } from '../../lib/money';
import { MASTER_DATA_TABLES } from '../../lib/masterDataApi';
import { formatMonth } from '../../lib/months';
import RecordFormModal from '../RecordFormModal';
import DeleteRecordModal from '../DeleteRecordModal';
import { isModuleLeadSeat, todayIso, unassignSeat } from '../../lib/teamActions';
import DeleteAssignmentForm from './DeleteAssignmentForm';
import IconButton from './IconButton';
import SeatRows from './SeatRows';
import { statusClass } from './statusClass';
import styles from './ControlCenter.module.css';

const ASSIGNMENTS_TABLE = MASTER_DATA_TABLES.find((table) => table.route === 'project-assignments');
const ASSIGNMENT_LABELS = Object.fromEntries(ASSIGNMENTS_TABLE.columns.map((column) => [column.key, column.label]));
const POSITIONS_TABLE = MASTER_DATA_TABLES.find((table) => table.route === 'positions');
const POSITION_LABELS = Object.fromEntries(POSITIONS_TABLE.columns.map((column) => [column.key, column.label]));
const POSITION_DETAIL_COLUMNS = POSITIONS_TABLE.columns.filter((column) =>
  ['code', 'name', 'teamName', 'competencies'].includes(column.key),
);
const LOCATIONS = ['Onsite', 'Offshore', 'Hybrid'];
const COMPETENCIES_MAX_LENGTH = 500;

// The team's competencies as the comma list the Position form pre-fills. Whole names only,
// in order, so the list never passes the field's length limit (a 422 the user did not cause).
const competenciesPrefill = (names) => {
  let list = '';
  for (const name of names) {
    const next = list ? `${list}, ${name}` : name;
    if (next.length > COMPETENCIES_MAX_LENGTH) break;
    list = next;
  }
  return list;
};

// The row the Edit form opens on: the field names the Project Assignments table uses.
const assignmentRecord = (teamCode, assignment) => ({
  id: assignment.id,
  projectId: assignment.projectId,
  teamId: teamCode,
  projectAssignmentStartDate: assignment.start,
  projectAssignmentEndDate: assignment.end,
});
const MODULE_LEAD_NOTE = 'Module Lead position is not counted in the total available, allocated and planned utilization hours.';
const LOCATION_CLASS = { Onsite: styles.dotOnsite, Offshore: styles.dotOffshore, Hybrid: styles.dotHybrid };

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

// `pageError` is the page's own refresh failure: the popup is refetched from
// the page's refreshes, so while those fail it must not claim to be live.
function TeamDialog({ code, month, updatedAt, pageError, onClose }) {
  const [reloads, setReloads] = useState(0);
  // null, { mode: 'add' } or { mode: 'edit', record }. The record is taken when the
  // form opens, so a refetch cannot change which assignment an open form saves to.
  const [form, setForm] = useState(null);
  // Inline forms in the popup: the position code of the vacant seat being
  // assigned, and the id of the project the Delete Project Assignment form is on.
  const [assigning, setAssigning] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [seatBusy, setSeatBusy] = useState(false);
  const [seatError, setSeatError] = useState(null);
  // The shared Add / Delete Position modals: null, { mode: 'add' } or { mode: 'delete', code }.
  const [positionModal, setPositionModal] = useState(null);
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
      if (positionModal) setPositionModal(null);
      else if (form) setForm(null);
      else if (assigning || deletingId) {
        setAssigning(null);
        setDeletingId(null);
      } else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, form, positionModal, assigning, deletingId]);

  const reload = () => {
    setSeatError(null);
    setReloads((n) => n + 1);
  };
  const projects = team?.projects ?? [];
  const today = todayIso();
  // The assignment Delete acts on: the first one by start that has not ended.
  const target = [...projects].sort((a, b) => a.start.localeCompare(b.start)).find((project) => project.end >= today) ?? null;
  const deleteTarget = projects.find((project) => project.id === deletingId) ?? null;
  const latestEnd = projects.reduce((latest, project) => (project.end > latest ? project.end : latest), '');

  // A refresh can fill the seat or drop the project an open form is on; React re-renders at once.
  if (team && assigning && !team.seats.some((seat) => seat.positionCode === assigning && seat.employeeId === null)) setAssigning(null);
  if (team && deletingId && !team.projects.some((project) => project.id === deletingId)) setDeletingId(null);

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
  const totalCostText = `${plan.truncated ? 'at least ' : ''}${formatUsd(plan.totalCost)}`;
  const hasModuleLead = team?.seats.some(isModuleLeadSeat) ?? false;
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
                  onClick={() => (target ? setDeletingId(target.id) : setForm({ mode: 'add' }))}
                >
                  {target ? 'Delete Project Assignment' : 'Add Project Assignment'}
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
                  <span className={styles.hoursLabel}>Allocated Team Monthly Cost</span>
                  <span className={styles.statValue}>{formatUsd(team.allocatedTeamCost)}</span>
                  {team.defaultedCostCount > 0 && (
                    <span className={styles.rowMeta}>
                      {team.defaultedCostCount} {team.defaultedCostCount === 1 ? 'person' : 'people'} costed at the default rate
                    </span>
                  )}
                </li>
                <li>
                  <span className={styles.hoursLabel}>Utilized Team Total Cost</span>
                  <span className={styles.statValue}>{team.monthlyPlan ? totalCostText : '—'}</span>
                </li>
                <li className={`${styles.statusPill} ${statusClass(styles, team.status)}`}>{STATUS_LABELS[team.status]}</li>
              </ul>

              {team.competencies.length > 0 && <p className={styles.dialogLine}>Competencies: {team.competencies.join(', ')}</p>}

              <div className={styles.dialogBody}>
                <div className={styles.dialogMain}>
                  <h3 className={styles.dialogHeading}>Projects</h3>
                  {projects.length === 0 ? (
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

                  {deleteTarget && (
                    <DeleteAssignmentForm
                      key={deleteTarget.id}
                      project={deleteTarget}
                      onCancel={() => setDeletingId(null)}
                      onSaved={() => {
                        setDeletingId(null);
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
                            onDelete={() => setPositionModal({ mode: 'delete', code: seat.positionCode })}
                            onSaved={() => {
                              setAssigning(null);
                              reload();
                            }}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className={styles.tableActions}>
                    <IconButton icon="plus" label="Add Position" onClick={() => setPositionModal({ mode: 'add' })} />
                  </div>
                  {hasModuleLead && <p className={styles.seatNote}>{MODULE_LEAD_NOTE}</p>}
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
                    total={projects.length > 0 ? `Assignment ends ${formatDay(latestEnd)}` : 'Planned utilization 0%'}
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
                    total={`Total ${totalCostText}`}
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

      {positionModal?.mode === 'add' && team && (
        <RecordFormModal
          key="add-position"
          route="positions"
          singularLabel="Position"
          labelByKey={POSITION_LABELS}
          initialValues={{ teamCode: team.code, competencies: competenciesPrefill(team.competencies) }}
          lockedKeys={['teamCode']}
          context={[
            { label: 'Team', value: `${team.code}, ${team.name}` },
            { label: 'Department', value: team.department.name ?? team.department.code },
            { label: 'Team competencies', value: team.competencies.join(', ') || 'None' },
          ]}
          onClose={() => setPositionModal(null)}
          onSaved={() => {
            setPositionModal(null);
            reload();
          }}
        />
      )}

      {positionModal?.mode === 'delete' && (
        <DeleteRecordModal
          key={positionModal.code}
          route="positions"
          singularLabel="Position"
          selectedValue={positionModal.code}
          detailColumns={POSITION_DETAIL_COLUMNS}
          onClose={() => setPositionModal(null)}
          onDeleted={() => {
            setPositionModal(null);
            reload();
          }}
        />
      )}

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
