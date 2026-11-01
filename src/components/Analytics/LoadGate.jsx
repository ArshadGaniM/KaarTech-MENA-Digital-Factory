import PropTypes from 'prop-types';
import styles from './Analytics.module.css';

// Shows Loading, or the error with Try again, until every dataset has arrived.
// A refresh that fails after data arrived keeps the old numbers and says so.
function LoadGate({ results, what, onRetry, children }) {
  const missing = results.find((result) => !result.data);
  const failed = results.find((result) => result.error);
  if (missing) {
    return failed ? (
      <p className={styles.error} role="alert">
        Could not load {what}: {failed.error.message}{' '}
        <button type="button" className={styles.linkButton} onClick={onRetry}>
          Try again
        </button>
      </p>
    ) : (
      <p className={styles.status} role="status">
        Loading…
      </p>
    );
  }
  return (
    <>
      {failed && (
        <p className={styles.error} role="alert">
          Could not refresh {what}, showing the earlier numbers: {failed.error.message}{' '}
          <button type="button" className={styles.linkButton} onClick={onRetry}>
            Try again
          </button>
        </p>
      )}
      {children}
    </>
  );
}

LoadGate.propTypes = {
  results: PropTypes.arrayOf(PropTypes.shape({ data: PropTypes.object, error: PropTypes.instanceOf(Error) })).isRequired,
  what: PropTypes.string.isRequired,
  onRetry: PropTypes.func.isRequired,
  children: PropTypes.node,
};

export default LoadGate;
