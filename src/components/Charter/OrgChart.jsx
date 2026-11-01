import PropTypes from 'prop-types';
import { ROLE, STAKEHOLDERS, TRACKS, roleLabel, withRole } from '../../data/stakeholders';
import styles from './OrgChart.module.css';

const personShape = PropTypes.shape({
  name: PropTypes.string.isRequired,
  designation: PropTypes.string.isRequired,
  role: PropTypes.string.isRequired,
  track: PropTypes.string,
  vertical: PropTypes.string,
});

// An open seat has no name yet. It shows its vertical and role in a dashed box.
function Box({ entry }) {
  const open = entry.name === '';
  return (
    <div className={`${styles.box} ${open ? styles.open : ''}`}>
      {open ? (
        <>
          <span className={styles.openLabel}>{entry.vertical} Vertical</span>
          <span className={styles.role}>{entry.role}</span>
        </>
      ) : (
        <>
          <span className={styles.name}>{entry.name}</span>
          <span className={styles.role}>{roleLabel(entry)}</span>
        </>
      )}
    </div>
  );
}

Box.propTypes = { entry: personShape.isRequired };

function TrackOwner({ entry }) {
  const coOwners = STAKEHOLDERS.filter((other) => other.role === ROLE.trackCoOwner && other.track === entry.track);
  return (
    <li>
      <Box entry={entry} />
      <ul className={styles.stack} aria-label={`Co-owners of ${entry.track}`}>
        {coOwners.map((coOwner) => (
          <li key={coOwner.vertical}>
            <Box entry={coOwner} />
          </li>
        ))}
      </ul>
    </li>
  );
}

TrackOwner.propTypes = { entry: personShape.isRequired };

// The sponsor leads. The initiative owners sit side by side under the sponsor,
// and their lines join into one line. The track owners hang from that one line,
// so each of them reports to all the owners together, not to one. Each track
// owner has one co-owner seat per vertical. Members are not drawn.
function OrgChart() {
  const [sponsor] = withRole(ROLE.sponsor);
  const owners = withRole(ROLE.owner);
  const trackOwners = TRACKS.map((track) => withRole(ROLE.trackOwner).find((entry) => entry.track === track));
  return (
    <div className={styles.scroll} tabIndex={0} role="region" aria-label="Initiative org structure diagram">
      <div className={styles.tree}>
        <ul className={styles.top}>
          <li>
            <Box entry={sponsor} />
            <ul className={styles.owners} aria-label="Initiative owners">
              {owners.map((entry) => (
                <li key={entry.name}>
                  <Box entry={entry} />
                  <span className={styles.join} aria-hidden="true" />
                </li>
              ))}
            </ul>
          </li>
        </ul>
        <ul className={styles.tracks} aria-label="Track owners, reporting to the initiative owners together">
          {trackOwners.map((entry) => (
            <TrackOwner key={entry.track} entry={entry} />
          ))}
        </ul>
      </div>
    </div>
  );
}

export default OrgChart;
