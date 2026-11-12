import { useState } from 'react';
import PropTypes from 'prop-types';
import { formatDay } from '../../lib/money';
import { dayBefore, deleteProjectAssignment, todayIso } from '../../lib/teamActions';
import styles from './ControlCenter.module.css';

// Deleting a running assignment ends it yesterday, so it stays as history and
// the team is free from today. One that has not started is removed instead.
function DeleteAssignmentForm({ project, onSaved, onCancel }) {
  const today = todayIso();
  const notStarted = project.start >= today;
  const [endDate, setEndDate] = useState(() => dayBefore(today));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!notStarted && !endDate) {
      setError(new Error('Give an end date.'));
      return;
    }
    if (!notStarted && (endDate < project.start || endDate > project.end)) {
      setError(new Error(`The end date must be between ${formatDay(project.start)} and ${formatDay(project.end)}.`));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await deleteProjectAssignment(project, endDate, today);
      onSaved();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <form className={styles.inlineForm} onSubmit={onSubmit} aria-label="Delete Project Assignment" noValidate>
      <p className={styles.inlineFormTitle}>Delete Project Assignment</p>
      <p className={styles.dialogLine}>
        <strong>{project.projectName ?? project.projectId}</strong>
        <span className={styles.rowMeta}>
          {formatDay(project.start)} to {formatDay(project.end)}, allocation {project.allocationPercentage ?? 100}%
        </span>
      </p>
      {notStarted ? (
        <p className={styles.dialogLine}>This project has not started, so the assignment is removed.</p>
      ) : (
        <div className={styles.formField}>
          <label htmlFor="delete-assignment-end">End date</label>
          <input
            id="delete-assignment-end"
            type="date"
            required
            min={project.start}
            max={project.end}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      )}
      {error && (
        <p className={styles.fieldError} role="alert">
          {error.message}
          {Object.values(error.details ?? {}).map((message) => (
            <span key={message} className={styles.rowMeta}>
              {message}
            </span>
          ))}
        </p>
      )}
      <div className={styles.inlineActions}>
        <button type="button" className={styles.editAssignment} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className={styles.addAssignment} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

DeleteAssignmentForm.propTypes = {
  project: PropTypes.shape({
    id: PropTypes.string.isRequired,
    projectId: PropTypes.string,
    projectName: PropTypes.string,
    start: PropTypes.string.isRequired,
    end: PropTypes.string.isRequired,
    allocationPercentage: PropTypes.number,
  }).isRequired,
  onSaved: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default DeleteAssignmentForm;
