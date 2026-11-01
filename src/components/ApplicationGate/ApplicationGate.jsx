import { useState } from 'react';
import PropTypes from 'prop-types';
import { isApplicationPassphrase } from '../../lib/applicationAccess';
import styles from './ApplicationGate.module.css';

function ApplicationGate({ onUnlock }) {
  const [value, setValue] = useState('');
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [unavailable, setUnavailable] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setChecking(true);
    setUnavailable(null);
    try {
      if (await isApplicationPassphrase(value)) {
        onUnlock();
      } else {
        setFailed(true);
      }
    } catch (err) {
      console.error(err);
      setUnavailable(err.message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className={styles.gate} aria-labelledby="application-gate-title">
      <form className={styles.form} onSubmit={handleSubmit}>
        <h2 id="application-gate-title">Enter the password to open the application</h2>
        <p className={styles.hint}>The application is private to the initiative team.</p>
        <label htmlFor="application-password" className={styles.label}>
          Password
        </label>
        <input
          id="application-password"
          type="password"
          className={styles.input}
          value={value}
          autoComplete="off"
          aria-invalid={failed}
          aria-describedby={failed ? 'application-password-error' : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setFailed(false);
          }}
        />
        {failed && (
          <p id="application-password-error" className={styles.error} role="alert">
            That password is not right. Try again.
          </p>
        )}
        {unavailable && (
          <p className={styles.error} role="alert">
            {unavailable}
          </p>
        )}
        <button type="submit" className={styles.submit} disabled={checking || value.trim() === ''}>
          Open the application
        </button>
        <a href="#top" className={styles.back}>
          Back to the portal
        </a>
      </form>
    </section>
  );
}

ApplicationGate.propTypes = {
  onUnlock: PropTypes.func.isRequired,
};

export default ApplicationGate;
