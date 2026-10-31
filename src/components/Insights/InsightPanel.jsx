import PropTypes from 'prop-types';
import styles from './Insights.module.css';

// The frame shared by the Dashboard's chart sections: a heading, a link to
// the matching table, the filter summary, and a row of cards.
function InsightPanel({ id, title, linkLabel, onLink, summary, children }) {
  return (
    <section aria-labelledby={id} className={styles.insights}>
      <div className={styles.header}>
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        <button type="button" className={styles.link} onClick={onLink}>
          {linkLabel}
        </button>
      </div>
      {summary}
      <div className={styles.cards}>{children}</div>
    </section>
  );
}

InsightPanel.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  linkLabel: PropTypes.string.isRequired,
  onLink: PropTypes.func.isRequired,
  summary: PropTypes.node,
  children: PropTypes.node.isRequired,
};

export default InsightPanel;
