import PropTypes from 'prop-types';
import { pluralize } from './pluralize';
import styles from './OrganizationStructure.module.css';

function SeatShareBar({ managers, totalSeats, selectedId, onSelect }) {
  const selected = managers.find((manager) => manager.id === selectedId);
  const percent = totalSeats > 0 && selected ? Math.round((selected.seats / totalSeats) * 100) : 0;

  return (
    <section className={styles.share} aria-label="Seats by manager">
      <div className={styles.shareHead}>
        <h2>Seat share by manager</h2>
        {selected && (
          <span>
            {selected.title} holds {percent}% of {totalSeats} seats
          </span>
        )}
      </div>
      <div className={styles.bar}>
        {managers.map((manager) => (
          <button
            key={manager.id}
            type="button"
            className={manager.id === selectedId ? styles.barSegmentOn : styles.barSegment}
            // A manager with no seats keeps a sliver so the segment can still be clicked.
            style={{ flexGrow: Math.max(manager.seats, 1) }}
            aria-pressed={manager.id === selectedId}
            aria-label={`${manager.title}, ${pluralize(manager.seats, 'seat')}`}
            onClick={() => onSelect(manager.id)}
          />
        ))}
      </div>
    </section>
  );
}

SeatShareBar.propTypes = {
  managers: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.string.isRequired, title: PropTypes.string.isRequired, seats: PropTypes.number.isRequired })
  ).isRequired,
  totalSeats: PropTypes.number.isRequired,
  selectedId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};

export default SeatShareBar;
