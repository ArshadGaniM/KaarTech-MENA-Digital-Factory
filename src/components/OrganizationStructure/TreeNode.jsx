import PropTypes from 'prop-types';
import styles from './OrganizationStructure.module.css';

function TreeNode({ id, isOpen, onToggle, title, meta, seats, children }) {
  return (
    <details className={styles.node} open={isOpen} onToggle={(event) => onToggle(id, event.currentTarget.open)}>
      <summary className={styles.nodeHeader}>
        <span className={styles.nodeTitle}>{title}</span>
        {meta && <span className={styles.meta}>{meta}</span>}
        {seats !== undefined && (
          <span className={styles.badge} aria-label={`${seats} seats`}>
            {seats}
          </span>
        )}
      </summary>
      <div className={styles.nodeBody}>{children}</div>
    </details>
  );
}

TreeNode.propTypes = {
  id: PropTypes.string.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  meta: PropTypes.string,
  seats: PropTypes.number,
  children: PropTypes.node,
};

export default TreeNode;
