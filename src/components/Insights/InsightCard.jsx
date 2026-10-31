import PropTypes from 'prop-types';
import styles from './Insights.module.css';

// One chart card. The hooks keep the last result while a refresh runs, so a
// failed refresh has both an error and data: the error shows above the
// chart and the chart stays. With no data yet, the card shows Loading until
// the first result or error arrives.
function InsightCard({ title, error, errorLabel, hasData, onRetry, children }) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>{title}</h3>
      {error && (
        <div className={styles.errorRow}>
          <p className={styles.error} role="alert">
            {`${errorLabel}: ${error.message}`}
          </p>
          <button type="button" className={styles.link} onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
      {hasData ? children : !error && <p className={styles.muted}>Loading…</p>}
    </div>
  );
}

InsightCard.propTypes = {
  title: PropTypes.string.isRequired,
  error: PropTypes.instanceOf(Error),
  errorLabel: PropTypes.string.isRequired,
  hasData: PropTypes.bool.isRequired,
  onRetry: PropTypes.func.isRequired,
  children: PropTypes.node,
};

export default InsightCard;
