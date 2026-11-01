import PropTypes from 'prop-types';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  SunburstChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { colorAt } from './palette';
import styles from './Analytics.module.css';


const HEIGHT = 280;
const shorten = (text) => (String(text).length > 24 ? `${String(text).slice(0, 23)}…` : text);
const AXIS = { fontSize: 12, fill: 'var(--color-text-muted)' };
const TOOLTIP = { contentStyle: { border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 12 } };
const seriesShape = PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string.isRequired, label: PropTypes.string.isRequired, color: PropTypes.string }));

// Bars for { name, value } entries, or for several series that share the name
// on one axis. `sideways` draws them as a ranked list. A click on a bar calls
// `onPick(name)`, and the picked bar stays solid while the others fade.
export function BarsChart({ data, series = [{ key: 'value', label: 'Count' }], sideways = false, stacked = false, activeName = null, onPick, height = HEIGHT }) {
  const rows = sideways ? Math.max(data.length * 26 + 40, height / 1.5) : height;
  return (
    <ResponsiveContainer width="100%" height={rows}>
      <BarChart data={data} layout={sideways ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 16, bottom: 8, left: sideways ? 8 : 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={!sideways} horizontal={sideways ? false : true} />
        {sideways ? <XAxis type="number" tick={AXIS} allowDecimals={false} /> : <XAxis dataKey="name" tick={AXIS} interval={0} angle={data.length > 4 ? -35 : 0} textAnchor={data.length > 4 ? 'end' : 'middle'} height={data.length > 4 ? 70 : 30} />}
        {sideways ? <YAxis type="category" dataKey="name" tick={AXIS} width={150} interval={0} tickFormatter={shorten} /> : <YAxis tick={AXIS} allowDecimals={false} />}
        <Tooltip {...TOOLTIP} />
        {series.length > 1 && <Legend verticalAlign="top" wrapperStyle={{ fontSize: 12 }} />}
        {series.map((item, seriesIndex) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.label}
            stackId={stacked ? 'stack' : undefined}
            fill={item.color ?? colorAt(seriesIndex)}
            cursor={onPick ? 'pointer' : undefined}
            onClick={onPick ? (entry) => onPick(entry.name) : undefined}
            isAnimationActive
          >
            {series.length === 1 && data.map((entry) => <Cell key={entry.name} fill={item.color ?? colorAt(0)} fillOpacity={activeName === null || activeName === entry.name ? 1 : 0.35} />)}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

BarsChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  series: seriesShape,
  sideways: PropTypes.bool,
  stacked: PropTypes.bool,
  activeName: PropTypes.string,
  onPick: PropTypes.func,
  height: PropTypes.number,
};

// Slices for { name, value } entries, with the total in the middle.
export function DonutPie({ data, activeName = null, onPick, colors = {}, total, centerLabel }) {
  return (
    <div className={styles.donutWrap}>
      <ResponsiveContainer width="100%" height={HEIGHT}>
        <PieChart>
          <Tooltip {...TOOLTIP} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={1} cursor={onPick ? 'pointer' : undefined} onClick={onPick ? (entry) => onPick(entry.name) : undefined}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={colors[entry.name] ?? colorAt(index)} fillOpacity={activeName === null || activeName === entry.name ? 1 : 0.35} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className={styles.donutCenter} aria-hidden="true">
        <strong>{total}</strong>
        <span>{centerLabel}</span>
      </div>
    </div>
  );
}

DonutPie.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string.isRequired, value: PropTypes.number.isRequired })).isRequired,
  activeName: PropTypes.string,
  onPick: PropTypes.func,
  colors: PropTypes.objectOf(PropTypes.string),
  total: PropTypes.string.isRequired,
  centerLabel: PropTypes.string.isRequired,
};

// Tiles sized by value, wrapping to rows. A click calls `onPick(name)`, and the
// picked tile stays solid while the others fade.
export function TileMap({ data, activeName = null, onPick }) {
  return (
    <ul className={styles.tileMap}>
      {data.filter((entry) => entry.value > 0).map((entry, index) => (
        <li key={entry.name} style={{ flex: `${entry.value} 1 ${Math.max(90, Math.min(220, entry.value * 4))}px` }}>
          <button
            type="button"
            className={styles.tileMapCell}
            style={{ background: colorAt(index), opacity: activeName === null || activeName === entry.name ? 1 : 0.35 }}
            aria-pressed={activeName === entry.name}
            disabled={!onPick}
            onClick={() => onPick(entry.name)}
          >
            <span>{entry.name}</span>
            <strong>{entry.value}</strong>
          </button>
        </li>
      ))}
    </ul>
  );
}

TileMap.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string.isRequired, value: PropTypes.number.isRequired })).isRequired,
  activeName: PropTypes.string,
  onPick: PropTypes.func,
};

// Points grouped into series, one colour per group.
export function ScatterPlot({ groups, xLabel, yLabel }) {
  return (
    <ResponsiveContainer width="100%" height={HEIGHT + 20}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 32, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis type="number" dataKey="x" name={xLabel} tick={AXIS} label={{ value: xLabel, position: 'insideBottom', offset: -16, fontSize: 12 }} />
        <YAxis type="number" dataKey="y" name={yLabel} tick={AXIS} label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: 12 }} />
        <ZAxis range={[40, 40]} />
        <Tooltip {...TOOLTIP} cursor={{ strokeDasharray: '3 3' }} />
        {groups.length > 1 && <Legend verticalAlign="top" wrapperStyle={{ fontSize: 12 }} />}
        {groups.map((group, index) => (
          <Scatter key={group.name} name={group.name} data={group.points} fill={colorAt(index)} fillOpacity={0.6} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

ScatterPlot.propTypes = {
  groups: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string.isRequired, points: PropTypes.arrayOf(PropTypes.object).isRequired })).isRequired,
  xLabel: PropTypes.string.isRequired,
  yLabel: PropTypes.string.isRequired,
};

// Columns, lines and areas over one category axis (usually months). A line
// with `right: true` reads on a second axis, for percentages beside hours.
export function TrendChart({ data, bars = [], lines = [], areas = [], percentAxis = false, activeKey = null, onPick }) {
  const Chart = areas.length > 0 && bars.length === 0 ? AreaChart : ComposedChart;
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <Chart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="label" tick={AXIS} />
        <YAxis yAxisId="left" tick={AXIS} hide={bars.length === 0 && areas.length === 0 && lines.every((item) => item.right)} />
        {percentAxis && <YAxis yAxisId="right" orientation="right" tick={AXIS} unit="%" domain={[0, 100]} />}
        <Tooltip {...TOOLTIP} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {areas.map((item, index) => (
          <Area key={item.key} yAxisId="left" type="monotone" dataKey={item.key} name={item.label} stackId="areas" stroke={item.color ?? colorAt(index)} fill={item.color ?? colorAt(index)} fillOpacity={0.5} />
        ))}
        {bars.map((item, index) => (
          <Bar key={item.key} yAxisId="left" dataKey={item.key} name={item.label} fill={item.color ?? colorAt(index)} cursor={onPick ? 'pointer' : undefined} onClick={onPick ? (entry) => onPick(entry.month) : undefined}>
            {data.map((entry) => (
              <Cell key={entry.month} fill={item.color ?? colorAt(index)} fillOpacity={activeKey === null || activeKey === entry.month ? 1 : 0.5} />
            ))}
          </Bar>
        ))}
        {lines.map((item, index) => (
          <Line key={item.key} yAxisId={item.right ? 'right' : 'left'} type="monotone" dataKey={item.key} name={item.label} stroke={item.color ?? colorAt(index + bars.length)} strokeWidth={2} dot={{ r: 3 }} />
        ))}
      </Chart>
    </ResponsiveContainer>
  );
}

const trendSeries = PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string.isRequired, label: PropTypes.string.isRequired, color: PropTypes.string, right: PropTypes.bool }));
TrendChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  bars: trendSeries,
  lines: trendSeries,
  areas: trendSeries,
  percentAxis: PropTypes.bool,
  activeKey: PropTypes.string,
  onPick: PropTypes.func,
};

// Rings for a tree of { name, children | value }.
export function SunburstView({ data }) {
  return (
    <div className={styles.center}>
      <SunburstChart width={440} height={HEIGHT + 100} data={data} dataKey="value" nameKey="name" fill="var(--color-chart-5)" stroke="var(--color-bg)" textOptions={{ fontSize: 0 }}>
        <Tooltip {...TOOLTIP} />
      </SunburstChart>
    </div>
  );
}

SunburstView.propTypes = {
  data: PropTypes.shape({ name: PropTypes.string.isRequired, children: PropTypes.array }).isRequired,
};

// A grid of counts. It is a real table, so it reads the same to a screen
// reader. The darker the cell, the larger the count.
export function Heatmap({ rowNames, colNames, colLabels = {}, cell, rowLabel, onPick }) {
  const max = Math.max(1, ...rowNames.flatMap((rowName) => colNames.map((colName) => cell(rowName, colName))));
  return (
    <div className={styles.tableWrap}>
      <table className={styles.heatmap}>
        <caption className={styles.srOnly}>{rowLabel}</caption>
        <thead>
          <tr>
            <th scope="col">{rowLabel}</th>
            {colNames.map((colName) => (
              <th key={colName} scope="col">
                {colLabels[colName] ?? colName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowNames.map((rowName) => (
            <tr key={rowName}>
              <th scope="row">{rowName}</th>
              {colNames.map((colName) => {
                const count = cell(rowName, colName);
                return (
                  <td key={colName} style={{ background: `color-mix(in srgb, var(--color-chart-5) ${Math.round((count / max) * 85)}%, var(--color-bg))` }}>
                    {onPick && count > 0 ? (
                      <button type="button" className={styles.cellButton} onClick={() => onPick(rowName, colName)}>
                        {count}
                      </button>
                    ) : (
                      count
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

Heatmap.propTypes = {
  rowNames: PropTypes.arrayOf(PropTypes.string).isRequired,
  colNames: PropTypes.arrayOf(PropTypes.string).isRequired,
  colLabels: PropTypes.objectOf(PropTypes.string),
  cell: PropTypes.func.isRequired,
  rowLabel: PropTypes.string.isRequired,
  onPick: PropTypes.func,
};
