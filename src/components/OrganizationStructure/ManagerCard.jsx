import PropTypes from 'prop-types';
import { pluralNoun } from './pluralize';
import styles from './OrganizationStructure.module.css';

const shortName = (name) => name.replace(' Operational Support', ' Support').replace(' Services', '');

function ManagerCard({ manager, maxSeats, isSelected, onSelect }) {
  return (
    <button
      type="button"
      className={isSelected ? styles.managerOn : styles.manager}
      aria-pressed={isSelected}
      onClick={() => onSelect(manager.id)}
    >
      <span className={styles.role}>ODC Project Manager</span>{' '}
      <span className={styles.managerTop}>
        <span className={styles.avatar} aria-hidden="true">
          TBD
        </span>
        <span>
          <span className={styles.managerTitle}>{manager.title}</span>{' '}
          {manager.name && <span className={styles.chipTbd}>Name {manager.name}</span>}
        </span>
      </span>{' '}
      <span className={styles.seats}>
        {manager.seats}
        <small> {pluralNoun(manager.seats, 'seat')}</small>
      </span>
      <span className={styles.meter} aria-hidden="true">
        <i style={{ width: `${Math.max(3, (manager.seats / maxSeats) * 100)}%` }} />
      </span>
      <span className={styles.deptNames}>
        {manager.departments.map((department) => (
          <span key={department.code}>{shortName(department.name)} </span>
        ))}
      </span>
    </button>
  );
}

ManagerCard.propTypes = {
  manager: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    name: PropTypes.string,
    seats: PropTypes.number.isRequired,
    departments: PropTypes.arrayOf(PropTypes.shape({ code: PropTypes.string.isRequired, name: PropTypes.string.isRequired }))
      .isRequired,
  }).isRequired,
  maxSeats: PropTypes.number.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default ManagerCard;
