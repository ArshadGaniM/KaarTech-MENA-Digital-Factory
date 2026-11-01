import PropTypes from 'prop-types';
import styles from './OrganizationStructure.module.css';

function TeamCard({ team }) {
  return (
    <li className={styles.team}>
      <div className={styles.teamHeader}>
        <span className={styles.teamName}>{team.name}</span>
        <span className={styles.badge} aria-label={`${team.seats} seats`}>
          {team.seats}
        </span>
      </div>
      {team.competencies.length > 0 && <p className={styles.competencies}>{team.competencies.join(', ')}</p>}
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
    competencies: PropTypes.arrayOf(PropTypes.string).isRequired,
    leadConsultants: PropTypes.number.isRequired,
    consultants: PropTypes.number.isRequired,
    others: PropTypes.number.isRequired,
  }).isRequired,
};

export default TeamCard;
