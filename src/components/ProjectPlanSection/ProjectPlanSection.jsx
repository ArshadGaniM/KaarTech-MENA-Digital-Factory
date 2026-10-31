import ProjectPlan from '../ProjectPlan';
import styles from './ProjectPlanSection.module.css';

// The initiative's own plan lives in the portal. The view is read-only here:
// actual progress is recorded elsewhere (see backend /v1/project-plan/actuals).
function ProjectPlanSection() {
  return (
    <section id="initiative-plan" className={styles.section} aria-labelledby="initiative-plan-title">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>The Initiative</p>
        <h2 id="initiative-plan-title">Initiative Plan</h2>
        <ProjectPlan readOnly />
      </div>
    </section>
  );
}

export default ProjectPlanSection;
