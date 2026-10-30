import FactoryBuilding from './FactoryBuilding';
import { FLOORS } from './factoryLayout';
import { useDepartmentNames } from '../../hooks/useDepartmentNames';
import styles from './ControlCenter.module.css';

function ControlCenter() {
  const { data: names, isLoading, error } = useDepartmentNames();

  if (isLoading) {
    return (
      <p className={styles.status} role="status" aria-live="polite">
        Loading…
      </p>
    );
  }
  if (error) {
    return (
      <p className={styles.statusError} role="alert">
        Could not load the departments: {error.message}
      </p>
    );
  }

  const floors = FLOORS.map((floor) => ({ ...floor, name: names.get(floor.departmentCode) ?? floor.departmentCode }));

  return (
    <div className={styles.stage}>
      <span className={styles.cloudOne} aria-hidden="true" />
      <span className={styles.cloudTwo} aria-hidden="true" />
      <FactoryBuilding floors={floors} />
    </div>
  );
}

export default ControlCenter;
