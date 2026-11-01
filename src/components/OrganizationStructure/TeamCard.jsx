import PropTypes from 'prop-types';
import styles from './OrganizationStructure.module.css';

function TeamCard({ team }) {
  return (
    <li className={styles.team}>
      <div className={styles.teamTop}>
        <b>{team.name}</b>
        <span className={styles.badge} aria-label={`${team.seats} seats`}>
          {team.seats}
        </span>
      </div>
      {team.competencies.length > 0 && (
        <div className={styles.comp}>
          {team.competencies.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      )}
      <div className={styles.seatGrid} aria-hidden="true">
        {team.seatStates.map((seat, index) => (
          <i key={index} className={seat.filled ? styles.seatFilled : styles.seatEmpty} />
        ))}
      </div>
      <p className={styles.legend}>
        {team.filled} of {team.seats} seats filled
      </p>
      <dl className={styles.roles}>
        <div>
          <dt>Lead Consultant</dt>
          <dd>{team.leadConsultants}</dd>
        </div>
        <div>
          <dt>Consultants</dt>
          <dd>{team.consultants}</dd>
        </div>
        {team.others > 0 && (
          <div>
            <dt>Other</dt>
            <dd>{team.others}</dd>
          </div>
        )}
      </dl>
    </li>
  );
}

TeamCard.propTypes = {
  team: PropTypes.shape({
    name: PropTypes.string.isRequired,
    seats: PropTypes.number.isRequired,
    filled: PropTypes.number.isRequired,
    seatStates: PropTypes.arrayOf(PropTypes.shape({ filled: PropTypes.bool.isRequired })).isRequired,
    competencies: PropTypes.arrayOf(PropTypes.string).isRequired,
    leadConsultants: PropTypes.number.isRequired,
    consultants: PropTypes.number.isRequired,
    others: PropTypes.number.isRequired,
  }).isRequired,
};

export default TeamCard;
