import PropTypes from 'prop-types';
import { formatHours, STATUS_LABELS } from '../../lib/hours';
import { teamShape } from './teamShape';
import styles from './ControlCenter.module.css';

const MAX_CHIPS = 3;

function TeamCard({ team, onOpen }) {
  const shown = team.competencies.slice(0, MAX_CHIPS);
  const hidden = team.competencies.length - shown.length;
  return (
    <li>
      <button
        type="button"
        className={`${styles.card} ${styles[`card${team.status[0].toUpperCase()}${team.status.slice(1)}`]}`}
        aria-label={`${team.name}, ${team.code}. ${STATUS_LABELS[team.status]}. Open details`}
        onClick={() => onOpen(team.code)}
      >
        {/* Re-mounts, and so replays its flash, whenever the hours change. */}
        <span key={`${team.allocatedHours}-${team.utilizedHours}`} className={styles.flash} aria-hidden="true" />
        <span className={styles.cardHead}>
          <span className={styles.cardName}>{team.name}</span>
          <span className={styles.cardCode}>{team.code}</span>
        </span>
        <span className={styles.chips}>
          {shown.length === 0 && <span className={styles.chipMuted}>No competency</span>}
          {shown.map((name) => (
            <span key={name} className={styles.chip}>
              {name}
            </span>
          ))}
          {hidden > 0 && <span className={styles.chip}>+{hidden}</span>}
        </span>
        <span className={styles.members}>
          {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
          <span className={styles.seats}>
            {team.seatCount} seats{team.vacantSeatCount > 0 ? `, ${team.vacantSeatCount} vacant` : ''}
          </span>
        </span>
        <span className={styles.hours}>
          <span>
            <span className={styles.hoursLabel}>Available</span>
            <span className={styles.hoursValue}>{formatHours(team.availableHours)}</span>
          </span>
          <span>
            <span className={styles.hoursLabel}>Allocated</span>
            <span className={styles.hoursValue}>{formatHours(team.allocatedHours)}</span>
          </span>
          <span>
            <span className={styles.hoursLabel}>Utilized</span>
            <span className={styles.hoursValue}>{formatHours(team.utilizedHours)}</span>
          </span>
        </span>
        <span className={styles.meter}>
          <span className={styles.meterTrack} aria-hidden="true">
            <span className={styles.meterFill} style={{ width: `${team.utilizationPercent}%` }} />
          </span>
          <span className={styles.meterValue}>{team.utilizationPercent}%</span>
        </span>
        <span className={styles.statusText}>{STATUS_LABELS[team.status]}</span>
      </button>
    </li>
  );
}

TeamCard.propTypes = {
  team: teamShape.isRequired,
  onOpen: PropTypes.func.isRequired,
};

export default TeamCard;
