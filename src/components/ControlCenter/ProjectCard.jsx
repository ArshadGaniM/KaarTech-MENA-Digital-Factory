import PropTypes from 'prop-types';
import { formatHours } from '../../lib/hours';
import { formatDay, formatUsd } from '../../lib/money';
import styles from './ControlCenter.module.css';

const formatPercent = (value) => `${value}%`;
// An older backend (frontend and backend deploy separately) sends no per-project figures.
const orDash = (value, format) => (value == null ? '—' : format(value));

// One project of the team: its dates, its allocation percentage, its own share of the utilized
// hours and cost, and Edit and Delete Project Assignment. A project that already ended is
// history, so it has no Delete: deleting it would only move its end date.
function ProjectCard({ project, isRunning, onEdit, onDelete }) {
  const name = project.projectName ?? project.projectId;
  return (
    <li className={styles.projectRow}>
      <div className={styles.projectInfo}>
        <strong className={styles.projectName}>{name}</strong>
        {project.projectName && <span className={styles.projectCode}>{project.projectId}</span>}
        <span className={styles.projectDates}>
          {formatDay(project.start)} to {formatDay(project.end)}
        </span>
        <span className={styles.projectShare}>Allocation {formatPercent(project.allocationPercentage ?? 100)}</span>
        <dl className={styles.projectStats}>
          <div>
            <dt className={styles.hoursLabel}>Planned utilization</dt>
            <dd className={styles.projectStatValue}>{orDash(project.utilizedHours, formatHours)}</dd>
          </div>
          <div>
            <dt className={styles.hoursLabel}>Utilized Team Monthly Cost</dt>
            <dd className={styles.projectStatValue}>{orDash(project.utilizedMonthlyCost, formatUsd)}</dd>
          </div>
          <div>
            <dt className={styles.hoursLabel}>Utilized Team Total Cost</dt>
            <dd className={styles.projectStatValue}>
              {orDash(project.utilizedTotalCost, (cost) => `${project.utilizedTotalTruncated ? 'at least ' : ''}${formatUsd(cost)}`)}
            </dd>
          </div>
        </dl>
      </div>
      <div className={styles.projectButtons}>
        <button type="button" className={styles.editAssignment} aria-label={`Edit ${name}`} onClick={onEdit}>
          Edit
        </button>
        {isRunning && (
          <button type="button" className={styles.deleteAssignment} aria-label={`Delete Project Assignment ${name}`} onClick={onDelete}>
            Delete Project Assignment
          </button>
        )}
      </div>
    </li>
  );
}

ProjectCard.propTypes = {
  project: PropTypes.shape({
    projectId: PropTypes.string,
    projectName: PropTypes.string,
    start: PropTypes.string.isRequired,
    end: PropTypes.string.isRequired,
    allocationPercentage: PropTypes.number,
    utilizedHours: PropTypes.number,
    utilizedMonthlyCost: PropTypes.number,
    utilizedTotalCost: PropTypes.number,
    utilizedTotalTruncated: PropTypes.bool,
  }).isRequired,
  isRunning: PropTypes.bool.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default ProjectCard;
