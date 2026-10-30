import PropTypes from 'prop-types';
import styles from './ControlCenter.module.css';

function TeamRoom({ code, order }) {
  return (
    <li className={styles.room} style={{ '--order': order }}>
      <span className={styles.lamp} aria-hidden="true" />
      <span className={styles.window} aria-hidden="true" />
      <span className={styles.worker} aria-hidden="true">
        <span className={styles.head} />
        <span className={styles.torso} />
      </span>
      <span className={styles.desk} aria-hidden="true">
        <span className={styles.monitor} />
        <span className={styles.monitor} />
      </span>
      <span className={styles.plaque}>{code}</span>
    </li>
  );
}

TeamRoom.propTypes = {
  code: PropTypes.string.isRequired,
  order: PropTypes.number.isRequired,
};

export default TeamRoom;
