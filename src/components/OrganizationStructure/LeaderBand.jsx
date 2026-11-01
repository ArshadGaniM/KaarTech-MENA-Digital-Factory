import PropTypes from 'prop-types';
import styles from './OrganizationStructure.module.css';

function LeaderBand({ leader, totalSeats, filledSeats, totalDepartments, totalTeams }) {
  return (
    <section className={styles.leader} aria-label={leader.title}>
      <div className={styles.leaderId}>
        <div className={styles.avatarLarge} aria-hidden="true">
          TBD
        </div>
        <div>
          <div className={styles.role}>{leader.title}</div>
          <div className={styles.leaderName}>MENA Digital Factory</div>
          <span className={styles.chipTbd}>Name {leader.name}</span>
        </div>
      </div>
      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Seats in total, {filledSeats} filled</dt>
          <dd>{totalSeats}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Departments</dt>
          <dd>{totalDepartments}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Teams</dt>
          <dd>{totalTeams}</dd>
        </div>
      </dl>
    </section>
  );
}

LeaderBand.propTypes = {
  leader: PropTypes.shape({ title: PropTypes.string.isRequired, name: PropTypes.string.isRequired }).isRequired,
  totalSeats: PropTypes.number.isRequired,
  filledSeats: PropTypes.number.isRequired,
  totalDepartments: PropTypes.number.isRequired,
  totalTeams: PropTypes.number.isRequired,
};

export default LeaderBand;
