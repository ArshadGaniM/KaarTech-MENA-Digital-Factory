import PropTypes from 'prop-types';
import { formatCount } from '../../lib/formatCount';
import styles from './DonutChart.module.css';

// One full turn of the circle is 100 units, so a segment's length is its
// percentage. r = 100 / (2 * PI).
const RADIUS = 15.9155;
const START_AT_TOP = 25;
const COLOUR_CLASSES = ['colour1', 'colour2', 'colour3', 'colour4'];

const colourOf = (index) => styles[COLOUR_CLASSES[Math.min(index, COLOUR_CLASSES.length - 1)]];

// The slices are drawn for the mouse. The legend buttons are the
// keyboard and screen reader controls, so the slices stay out of the
// accessibility tree. A segment with `selectable: false` has no value to
// filter on (for example "Not set").
function DonutChart({ segments, selectedKey = null, onSelect, centerLabel }) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  if (total === 0) return <p className={styles.empty}>No data yet.</p>;

  const arcs = segments.map((segment, index) => {
    const drawnBefore = segments.slice(0, index).reduce((sum, earlier) => sum + earlier.count, 0);
    return {
      ...segment,
      index,
      share: (segment.count / total) * 100,
      offset: START_AT_TOP - (drawnBefore / total) * 100,
    };
  });
  const dimmed = (key) => selectedKey !== null && selectedKey !== key;

  return (
    <div className={styles.chart}>
      <svg viewBox="0 0 42 42" className={styles.svg} aria-hidden="true">
        <circle cx="21" cy="21" r={RADIUS} className={styles.track} />
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            cx="21"
            cy="21"
            r={RADIUS}
            className={`${styles.slice} ${colourOf(arc.index)} ${dimmed(arc.key) ? styles.dimmed : ''} ${arc.selectable === false ? '' : styles.clickable}`}
            strokeDasharray={`${arc.share} ${100 - arc.share}`}
            strokeDashoffset={arc.offset}
            style={{ animationDelay: `${arc.index * 120}ms`, ...(arc.colorVar && { stroke: `var(${arc.colorVar})` }) }}
            onClick={arc.selectable === false ? undefined : () => onSelect(arc.key)}
          >
            <title>{`${arc.label}: ${formatCount(arc.count)} (${Math.round(arc.share)}%)`}</title>
          </circle>
        ))}
        <text x="21" y="21" className={styles.centerValue}>
          {formatCount(total)}
        </text>
        <text x="21" y="26" className={styles.centerLabel}>
          {centerLabel}
        </text>
      </svg>
      <ul className={styles.legend}>
        {arcs.map((arc) => (
          <li key={arc.key}>
            <button
              type="button"
              className={styles.legendItem}
              aria-pressed={selectedKey === arc.key}
              disabled={arc.selectable === false}
              onClick={() => onSelect(arc.key)}
            >
              <span
                className={`${styles.swatch} ${colourOf(arc.index)}`}
                style={arc.colorVar ? { background: `var(${arc.colorVar})` } : undefined}
                aria-hidden="true"
              />
              <span className={styles.legendLabel}>{arc.label}</span>{' '}
              <span className={styles.legendValue}>
                {formatCount(arc.count)} ({Math.round(arc.share)}%)
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

DonutChart.propTypes = {
  segments: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      count: PropTypes.number.isRequired,
      selectable: PropTypes.bool,
      colorVar: PropTypes.string,
    })
  ).isRequired,
  selectedKey: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  centerLabel: PropTypes.string.isRequired,
};

export default DonutChart;
