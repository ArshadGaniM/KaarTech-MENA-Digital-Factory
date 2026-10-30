import FactoryFloor from './FactoryFloor';
import { FLOORS } from './factoryLayout';
import { useFactoryData } from '../../hooks/useFactoryData';
import styles from './ControlCenter.module.css';

function ControlCenter() {
  const { data, isLoading, error } = useFactoryData();

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
        Could not load the factory: {error.message}
      </p>
    );
  }

  return (
    <div className={styles.controlCenter}>
      <section className={styles.building} aria-labelledby="factory-title">
        <h2 id="factory-title" className={styles.roof}>
          MENA Digital Factory
        </h2>
        <ol className={styles.floors}>
          {FLOORS.map((floor) => (
            <FactoryFloor
              key={floor.id}
              name={data.departmentNames.get(floor.departmentCode) ?? floor.departmentCode}
              teams={data.teamCodesByDepartment.get(floor.departmentCode) ?? []}
            />
          ))}
        </ol>
      </section>
    </div>
  );
}

export default ControlCenter;
