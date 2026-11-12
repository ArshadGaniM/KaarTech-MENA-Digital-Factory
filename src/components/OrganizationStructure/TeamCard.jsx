import PropTypes from 'prop-types';
import styles from './OrganizationStructure.module.css';

// The whole card opens the team popup. The name is the button, so keyboard users reach it,
// and a click anywhere else on the card reaches the same handler.
function TeamCard({ team, onOpen }) {
  return (
    <li className={`${styles.team} ${styles.teamClickable}`} onClick={() => onOpen(team.code)}>
      <div className={styles.teamTop}>
        <button type="button" className={styles.teamOpen} aria-label={`${team.name}, ${team.code}. Open details`}>
          {team.name}
        </button>
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
  onOpen: PropTypes.func.isRequired,
  team: PropTypes.shape({
    code: PropTypes.string.isRequired,
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
