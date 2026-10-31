import PropTypes from 'prop-types';
import styles from './ControlCenter.module.css';

function FactoryFloor({ name, teams }) {
  return (
    <li className={styles.floor}>
      <h3 className={styles.floorName}>{name}</h3>
      <ul className={styles.teams} aria-label={`${name} teams`}>
        {teams.length === 0 ? (
          <li className={styles.noTeams}>No teams yet</li>
        ) : (
          teams.map((code) => (
            <li key={code} className={styles.team}>
              {code}
            </li>
          ))
        )}
      </ul>
    </li>
  );
}

FactoryFloor.propTypes = {
  name: PropTypes.string.isRequired,
  teams: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default FactoryFloor;
