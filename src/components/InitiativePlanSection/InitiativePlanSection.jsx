import InitiativePlan from '../InitiativePlan';
import styles from './InitiativePlanSection.module.css';

// The initiative's own plan lives in the portal. The view is read-only here:
// actual progress is recorded elsewhere (see backend /v1/initiative-plan/actuals).
function InitiativePlanSection() {
  return (
    <section id="initiative-plan" className={styles.section} aria-labelledby="initiative-plan-title">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>The Initiative</p>
        <h2 id="initiative-plan-title">Initiative Plan</h2>
        <InitiativePlan readOnly />
      </div>
    </section>
  );
}

export default InitiativePlanSection;
