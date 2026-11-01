import PropTypes from 'prop-types';
import TeamCard from './TeamCard';
import { teamShape } from './teamShape';
import styles from './ControlCenter.module.css';

// Teams arrive sorted by practice, then by when they become free, so
// consecutive teams of one practice form a group and keep that order.
function groupByPractice(teams) {
  const groups = [];
  for (const team of teams) {
    const key = team.practiceCode ?? null;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.teams.push(team);
    else groups.push({ key, label: team.practiceName ?? 'No practice', teams: [team] });
  }
  return groups;
}

function FactoryFloor({ name, level, order, teams, onOpenTeam }) {
  return (
    <li className={styles.floor} style={{ '--order': order }}>
      <div className={styles.floorSign}>
        {Number.isInteger(level) && (
          <span className={styles.floorNumber} aria-hidden="true">
            F{level}
          </span>
        )}
        <h3 className={styles.floorName}>{name}</h3>
        <span className={styles.floorCount}>{teams.length} {teams.length === 1 ? 'team' : 'teams'}</span>
        <span className={styles.conveyor} aria-hidden="true" />
      </div>
      <div className={styles.floorBody}>
        {teams.length === 0 ? (
          <p className={styles.noTeams}>No teams yet</p>
        ) : (
          groupByPractice(teams).map((group) => (
            <section key={group.key ?? 'none'} className={styles.group} aria-label={`${group.label} teams`}>
              <h4 className={styles.groupLabel}>{group.label}</h4>
              <ul className={styles.cards} aria-label={`${name}, ${group.label} teams`}>
                {group.teams.map((team) => (
                  <TeamCard key={team.code} team={team} onOpen={onOpenTeam} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </li>
  );
}

FactoryFloor.propTypes = {
  name: PropTypes.string.isRequired,
  level: PropTypes.number,
  order: PropTypes.number.isRequired,
  teams: PropTypes.arrayOf(teamShape).isRequired,
  onOpenTeam: PropTypes.func.isRequired,
};

export default FactoryFloor;
