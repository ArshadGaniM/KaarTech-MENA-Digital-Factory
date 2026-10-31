import { useState } from 'react';
import PropTypes from 'prop-types';
import { PLAN_WEEK_COUNT } from '../../data/projectPlan';
import { savePlanActual, clearPlanActual } from '../../lib/projectPlanApi';
import styles from './ActualDialog.module.css';

// Records (or clears) the actual progress of one plan activity. The plan itself
// is never touched: this writes only to the actuals, beside it.

const toWeek = (text) => (text.trim() === '' ? null : Number(text));

function ActualDialog({ row, actual, onClose, onSaved }) {
  const [start, setStart] = useState(actual?.actualStartWeek != null ? String(actual.actualStartWeek) : '');
  const [end, setEnd] = useState(actual?.actualEndWeek != null ? String(actual.actualEndWeek) : '');
  const [poc, setPoc] = useState(actual ? String(actual.actualPoc) : '0');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  async function run(action) {
    setIsBusy(true);
    setErrors({});
    setMessage(null);
    try {
      await action();
      onSaved();
    } catch (err) {
      setErrors(err.details ?? {});
      setMessage(err.message);
      setIsBusy(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    run(() =>
      savePlanActual(row.slNo, { actualStartWeek: toWeek(start), actualEndWeek: toWeek(end), actualPoc: Number(poc) })
    );
  }

  const field = (id, label, value, setValue, key, extra) => (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={Boolean(errors[key])} {...extra} />
      {errors[key] && <p className={styles.fieldError} role="alert">{errors[key]}</p>}
    </div>
  );

  return (
    <div className={styles.backdrop} role="presentation">
      <form className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="actual-title" onSubmit={handleSubmit}>
        <h2 id="actual-title" className={styles.title}>Actual progress</h2>
        <p className={styles.activity}>
          {row.slNo} {row.activity}
        </p>
        <p className={styles.hint}>
          Planned: Week {row.startWeek} to Week {row.endWeek}. This does not change the plan.
        </p>
        {field('actual-start', 'Actual start week', start, setStart, 'actualStartWeek', { min: 1, max: PLAN_WEEK_COUNT, step: 1, placeholder: 'Not started' })}
        {field('actual-end', 'Actual end week', end, setEnd, 'actualEndWeek', { min: 1, max: PLAN_WEEK_COUNT, step: 1, placeholder: 'Not finished' })}
        {field('actual-poc', 'Actual percent complete', poc, setPoc, 'actualPoc', { min: 0, max: 100, step: 1, required: true })}
        {message && <p className={styles.error} role="alert">{message}</p>}
        <div className={styles.actions}>
          {actual && (
            <button type="button" className={styles.clear} disabled={isBusy} onClick={() => run(() => clearPlanActual(row.slNo))}>
              Clear actual
            </button>
          )}
          <button type="button" className={styles.cancel} disabled={isBusy} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.save} disabled={isBusy}>
            {isBusy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

ActualDialog.propTypes = {
  row: PropTypes.shape({
    slNo: PropTypes.string.isRequired,
    activity: PropTypes.string.isRequired,
    startWeek: PropTypes.number.isRequired,
    endWeek: PropTypes.number.isRequired,
  }).isRequired,
  actual: PropTypes.shape({
    actualStartWeek: PropTypes.number,
    actualEndWeek: PropTypes.number,
    actualPoc: PropTypes.number,
  }),
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

export default ActualDialog;
