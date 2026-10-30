import PropTypes from 'prop-types';
import FactoryFloor from './FactoryFloor';
import styles from './ControlCenter.module.css';

function FactoryBuilding({ floors }) {
  return (
    <section className={styles.building} aria-labelledby="factory-title">
      <div className={styles.roof} aria-hidden="true">
        <span className={styles.chimneyLeft}>
          <span className={styles.smoke} />
          <span className={styles.smoke} />
        </span>
        <span className={styles.chimneyRight}>
          <span className={styles.smoke} />
          <span className={styles.smoke} />
        </span>
        <span className={styles.teeth} />
      </div>
      <h2 id="factory-title" className={styles.sign}>
        MENA Digital Factory
      </h2>
      <div className={styles.body}>
        <div className={styles.shaft} aria-hidden="true">
          <span className={styles.car} />
        </div>
        <ol className={styles.floors}>
          {floors.map((floor, i) => (
            <FactoryFloor key={floor.id} name={floor.name} level={floors.length - i} teams={floor.teams} />
          ))}
        </ol>
      </div>
      <div className={styles.ground} aria-hidden="true">
        <span className={styles.belt} />
        <span className={styles.crate} />
        <span className={styles.crate} />
        <span className={styles.crate} />
      </div>
    </section>
  );
}

FactoryBuilding.propTypes = {
  floors: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      teams: PropTypes.arrayOf(PropTypes.string).isRequired,
    })
  ).isRequired,
};

export default FactoryBuilding;
