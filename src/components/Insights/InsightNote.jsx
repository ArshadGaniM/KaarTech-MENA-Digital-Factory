import PropTypes from 'prop-types';
import styles from './Insights.module.css';

function InsightNote({ children }) {
  return <p className={styles.muted}>{children}</p>;
}

InsightNote.propTypes = {
  children: PropTypes.node.isRequired,
};

export default InsightNote;
