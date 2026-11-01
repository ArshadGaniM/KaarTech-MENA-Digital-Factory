import PropTypes from 'prop-types';
import { pluralNoun } from './pluralize';
import { practiceColor } from './practiceColor';
import styles from './OrganizationStructure.module.css';

function DepartmentTile({ department, onOpen }) {
  return (
    <button type="button" className={styles.dept} onClick={() => onOpen(department.code)}>
      <span className={styles.deptTop}>
        <span className={styles.deptName}>{department.name}</span>
        <span className={styles.floor}>Floor {department.floorNumber ?? '–'}</span>
      </span>
      <span className={styles.deptMeta}>{department.code}</span>
      <span className={styles.deptNums}>
        <span>
          <b>{department.seats}</b>
          <small>{pluralNoun(department.seats, 'seat')}</small>
        </span>
        <span>
          <b>{department.teamCount}</b>
          <small>{pluralNoun(department.teamCount, 'team')}</small>
        </span>
        <span>
          <b>{department.practices.length}</b>
          <small>{pluralNoun(department.practices.length, 'practice')}</small>
        </span>
      </span>
      <span className={styles.mix} aria-hidden="true">
        {department.practices.map((practice) => (
          <i key={practice.code} style={{ flexGrow: practice.teamCount, background: practiceColor(practice.code) }} />
        ))}
      </span>
    </button>
  );
}

DepartmentTile.propTypes = {
  department: PropTypes.shape({
    code: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    floorNumber: PropTypes.number,
    seats: PropTypes.number.isRequired,
    teamCount: PropTypes.number.isRequired,
    practices: PropTypes.arrayOf(
      PropTypes.shape({ code: PropTypes.string.isRequired, teamCount: PropTypes.number.isRequired })
    ).isRequired,
  }).isRequired,
  onOpen: PropTypes.func.isRequired,
};

export default DepartmentTile;
