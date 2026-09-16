import { useMasterDataTable } from '../../hooks/useMasterDataTable';
import styles from './MasterDataTable.module.css';

const DATE_COLUMN_KEYS = new Set(['createdAt', 'updatedAt']);
const ENUM_COLUMN_KEYS = new Set(['locationType']);

function capitalize(value) {
  return typeof value === 'string' ? value.replace(/\b\w/g, (letter) => letter.toUpperCase()) : value;
}

function formatCell(column, value) {
  if (DATE_COLUMN_KEYS.has(column.key)) return new Date(value).toLocaleString();
  if (ENUM_COLUMN_KEYS.has(column.key)) return capitalize(value);
  return value;
}

function MasterDataTable({ route, columns }) {
  const { data, isLoading, error } = useMasterDataTable(route);

  if (isLoading) return <p className={styles.status}>Loading…</p>;
  if (error) return <p className={styles.statusError}>Could not load this table: {error.message}</p>;

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr>
            <td className={styles.status} colSpan={columns.length}>
              No records yet. Add one via the MCP tools.
            </td>
          </tr>
        ) : (
          data.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.key}>{formatCell(column, row[column.key])}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export default MasterDataTable;
