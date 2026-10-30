import FactoryFloor from './FactoryFloor';
import { FLOORS } from './factoryLayout';
import styles from './ControlCenter.module.css';

function ControlCenter() {
  return (
    <div className={styles.controlCenter}>
      <section className={styles.building} aria-labelledby="factory-title">
        <h2 id="factory-title" className={styles.roof}>
          MENA Digital Factory
        </h2>
        <ol className={styles.floors}>
          {FLOORS.map((floor) => (
            <FactoryFloor key={floor.id} name={floor.name} teams={floor.teams} />
          ))}
        </ol>
      </section>
    </div>
  );
}

export default ControlCenter;
