import PropTypes from 'prop-types';
import styles from './OrganizationStructure.module.css';

// A row that opens and closes the list under it. The list exists only while
// open, so `aria-controls` names it only then.
function TreeToggle({ id, isOpen, onToggle, children }) {
  return (
    <button type="button" className={styles.treeRowButton} aria-expanded={isOpen} aria-controls={isOpen ? id : undefined} onClick={onToggle}>
      <span className={styles.treeCaret} aria-hidden="true" />
      {children}
    </button>
  );
}

TreeToggle.propTypes = {
  id: PropTypes.string.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

export default TreeToggle;
