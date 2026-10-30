import PropTypes from 'prop-types';
import TeamRoom from './TeamRoom';
import styles from './ControlCenter.module.css';

function FactoryFloor({ name, level, teams }) {
  return (
    <li className={styles.floor} style={{ '--level': level }}>
      <div className={styles.floorSign}>
        <span className={styles.floorNumber} aria-hidden="true">
          F{level}
        </span>
        <h3 className={styles.floorName}>{name}</h3>
      </div>
      <ul className={styles.rooms} aria-label={`${name} teams`}>
        {teams.map((code, i) => (
          <TeamRoom key={code} code={code} order={level * 3 + i} />
        ))}
      </ul>
    </li>
  );
}

FactoryFloor.propTypes = {
  name: PropTypes.string.isRequired,
  level: PropTypes.number.isRequired,
  teams: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default FactoryFloor;
