import { useState } from 'react';
import PropTypes from 'prop-types';
import { isPortalPassphrase } from '../../lib/portalAccess';
import styles from './PortalGate.module.css';

function PortalGate({ onUnlock }) {
  const [value, setValue] = useState('');
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setChecking(true);
    try {
      if (await isPortalPassphrase(value)) {
        onUnlock();
      } else {
        setFailed(true);
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className={styles.gate} aria-labelledby="portal-gate-title">
      <form className={styles.form} onSubmit={handleSubmit}>
        <h2 id="portal-gate-title">Enter the password to continue</h2>
        <p className={styles.hint}>The rest of this portal is private to the initiative team.</p>
        <label htmlFor="portal-password" className={styles.label}>
          Password
        </label>
        <input
          id="portal-password"
          type="password"
          className={styles.input}
          value={value}
          autoComplete="off"
          aria-invalid={failed}
          aria-describedby={failed ? 'portal-password-error' : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setFailed(false);
          }}
        />
        {failed && (
          <p id="portal-password-error" className={styles.error} role="alert">
            That password is not right. Try again.
          </p>
        )}
        <button type="submit" className={styles.submit} disabled={checking || value.trim() === ''}>
          Open the portal
        </button>
      </form>
    </section>
  );
}

PortalGate.propTypes = {
  onUnlock: PropTypes.func.isRequired,
};

export default PortalGate;
