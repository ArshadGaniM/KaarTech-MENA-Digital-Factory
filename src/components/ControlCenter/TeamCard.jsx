import PropTypes from 'prop-types';
import { formatHours, STATUS_LABELS } from '../../lib/hours';
import { formatDay, formatUsd } from '../../lib/money';
import { statusClass } from './statusClass';
import { teamShape } from './teamShape';
import styles from './ControlCenter.module.css';

// A card holds its competencies on one line. Widths are estimated from the text
// (12px bold chips in a 154px line), a little generously, because the browser
// cannot be asked inside a test. The chips never wrap, so a wrong guess clips
// instead of growing the card.
const LINE_WIDTH = 154;
const CHIP_GAP = 4;
const CHIP_PADDING = 18;
const CHAR_WIDTH = 7.4;
const MORE_CHIP_WIDTH = 40;

function chipWidth(name) {
  return Math.ceil(name.length * CHAR_WIDTH) + CHIP_PADDING;
}

function countThatFit(names) {
  let used = 0;
  let count = 0;
  for (let i = 0; i < names.length; i += 1) {
    const need = chipWidth(names[i]) + (i > 0 ? CHIP_GAP : 0);
    const reserve = i < names.length - 1 ? MORE_CHIP_WIDTH + CHIP_GAP : 0;
    if (count > 0 && used + need + reserve > LINE_WIDTH) break;
    used += need;
    count += 1;
  }
  return count;
}

function TeamCard({ team, onOpen }) {
  const shown = team.competencies.slice(0, countThatFit(team.competencies));
  const hidden = team.competencies.length - shown.length;
  const tipId = `${team.code}-competencies`;
  return (
    <li>
      <button
        type="button"
        className={`${styles.card} ${statusClass(styles, team.status)}`}
        aria-label={`${team.name}, ${team.code}. ${STATUS_LABELS[team.status]}. Open details`}
        aria-describedby={hidden > 0 ? tipId : undefined}
        onClick={() => onOpen(team.code)}
      >
        {/* Re-mounts, and so replays its flash, whenever the hours change. */}
        <span key={`${team.allocatedHours}-${team.utilizedHours}`} className={styles.flash} aria-hidden="true" />
        <span className={styles.cardHead}>
          <span className={styles.cardName}>{team.name}</span>
          <span className={styles.cardCode}>{team.code}</span>
        </span>
        <span className={styles.chipsWrap}>
          <span className={styles.chips}>
            {shown.length === 0 && <span className={styles.chipMuted}>No competency</span>}
            {shown.map((name) => (
              <span key={name} className={styles.chip}>
                {name}
              </span>
            ))}
            {hidden > 0 && <span className={`${styles.chip} ${styles.chipMore}`}>+{hidden}</span>}
          </span>
          {hidden > 0 && (
            <span id={tipId} role="tooltip" className={styles.chipsTip}>
              {team.competencies.join(', ')}
            </span>
          )}
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
        <span className={styles.cardFacts}>
          <span>
            <span className={styles.hoursLabel}>Assignment ends</span>
            <span className={styles.factValue}>
              {team.assignmentEndDate ? formatDay(team.assignmentEndDate) : 'No current assignment'}
            </span>
          </span>
          <span>
            <span className={styles.hoursLabel}>Allocated Team Cost</span>
            <span className={styles.factValue}>{formatUsd(team.allocatedTeamCost ?? 0)}</span>
            {team.defaultedCostCount > 0 && <span className={styles.hoursLabel}>{team.defaultedCostCount} at the default rate</span>}
          </span>
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
