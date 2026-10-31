import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTeamDetail } from '../../hooks/useTeamDetail';
import { formatHours, STATUS_LABELS } from '../../lib/hours';
import { formatMonth } from '../../lib/months';
import styles from './ControlCenter.module.css';

const percent = (value) => (value === null ? '—' : `${value}%`);

function TeamDialog({ code, month, onClose }) {
  const { data: team, isLoading, error } = useTeamDetail(code, month);
  const closeRef = useRef(null);

  // Focus moves into the dialog on open and back to the card that opened it.
  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
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
          <button ref={closeRef} type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {isLoading ? (
          <p role="status" aria-live="polite">
            Loading…
          </p>
        ) : error ? (
          <p className={styles.statusError} role="alert">
            Could not load the team: {error.message}
          </p>
        ) : (
          <>
            <ul className={styles.dialogStats}>
              <li>
                <span className={styles.hoursLabel}>Available</span>
                <span className={styles.statValue}>{formatHours(team.availableHours)}</span>
              </li>
              <li>
                <span className={styles.hoursLabel}>Allocated</span>
                <span className={styles.statValue}>{formatHours(team.allocatedHours)}</span>
              </li>
              <li>
                <span className={styles.hoursLabel}>Utilized</span>
                <span className={styles.statValue}>{formatHours(team.utilizedHours)}</span>
              </li>
              <li className={`${styles.statusPill} ${styles[`card${team.status[0].toUpperCase()}${team.status.slice(1)}`]}`}>{STATUS_LABELS[team.status]}</li>
            </ul>

            {team.competencies.length > 0 && (
              <p className={styles.dialogLine}>Competencies: {team.competencies.join(', ')}</p>
            )}

            <h3 className={styles.dialogHeading}>Projects</h3>
            {team.projects.length === 0 ? (
              <p className={styles.dialogLine}>No project assignment for this team.</p>
            ) : (
              <ul className={styles.projectList}>
                {team.projects.map((project) => (
                  <li key={`${project.projectId}-${project.start}-${project.end}`}>
                    {project.projectName ?? project.projectId}, {project.start} to {project.end}
                  </li>
                ))}
              </ul>
            )}

            <h3 className={styles.dialogHeading}>Positions and people</h3>
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
                </tr>
              </thead>
              <tbody>
                {team.seats.map((seat) => (
                  <tr key={`${seat.positionCode}-${seat.employeeId ?? 'vacant'}`} className={seat.employeeId === null ? styles.vacantRow : undefined}>
                    <th scope="row">
                      {seat.positionName}
                      <span className={styles.rowMeta}>
                        {seat.positionCode}
                        {seat.counted ? '' : ', not counted in the team'}
                      </span>
                    </th>
                    <td>{seat.employeeName ?? 'Vacant'}</td>
                    <td className={styles.numeric}>{percent(seat.allocationPercentage)}</td>
                    <td className={styles.numeric}>{percent(seat.availablePercentage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

TeamDialog.propTypes = {
  code: PropTypes.string.isRequired,
  month: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default TeamDialog;
