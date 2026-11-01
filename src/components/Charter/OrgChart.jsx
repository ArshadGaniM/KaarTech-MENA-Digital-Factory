import PropTypes from 'prop-types';
import { ROLE, STAKEHOLDERS, TRACKS, roleLabel, withRole } from '../../data/stakeholders';
import styles from './OrgChart.module.css';

const personShape = PropTypes.shape({
  name: PropTypes.string.isRequired,
  designation: PropTypes.string.isRequired,
  role: PropTypes.string.isRequired,
  track: PropTypes.string,
});

// An open seat has no name yet. It shows its vertical and role in a dashed box.
function Box({ entry }) {
  const open = entry.name === '';
  return (
    <div className={`${styles.box} ${open ? styles.open : ''}`}>
      {open ? (
        <>
          <span className={styles.openLabel}>{entry.designation}</span>
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
          <li key={coOwner.designation}>
            <Box entry={coOwner} />
          </li>
        ))}
      </ul>
    </li>
  );
}

TrackOwner.propTypes = { entry: personShape.isRequired };

// The sponsor leads. The owner and the co-owners report to the sponsor. The track
// owners report to the owner, and each track owner has one co-owner seat per
// vertical. Members are not drawn.
function OrgChart() {
  const [sponsor] = withRole(ROLE.sponsor);
  const [owner] = withRole(ROLE.owner);
  const trackOwners = TRACKS.map((track) => withRole(ROLE.trackOwner).find((entry) => entry.track === track));
  return (
    <div className={styles.scroll} tabIndex={0} role="region" aria-label="Initiative org structure diagram">
      <ul className={`${styles.tree} ${styles.root}`}>
        <li>
          <Box entry={sponsor} />
          <ul>
            <li>
              <Box entry={owner} />
              <ul>
                {trackOwners.map((entry) => (
                  <TrackOwner key={entry.track} entry={entry} />
                ))}
              </ul>
            </li>
            {withRole(ROLE.coOwner).map((entry) => (
              <li key={entry.name}>
                <Box entry={entry} />
              </li>
            ))}
          </ul>
        </li>
      </ul>
    </div>
  );
}

export default OrgChart;
