import styles from './Dashboard.module.css';

// Shown when the charts file cannot be fetched, for example after a new deploy.
function AnalyticsUnavailable() {
  return (
    <div className={styles.failure}>
      <p className={styles.statusError} role="alert">
        The charts could not be loaded. The site may have been updated.
      </p>
      <button type="button" className={styles.refreshButton} onClick={() => window.location.reload()}>
        Reload the page
      </button>
    </div>
  );
}

export default AnalyticsUnavailable;
