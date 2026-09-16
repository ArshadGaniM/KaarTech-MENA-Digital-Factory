import { useMasterDataTable } from '../../hooks/useMasterDataTable';
import styles from './MasterDataTable.module.css';

const DATE_COLUMN_KEYS = new Set(['createdAt', 'updatedAt']);

function formatCell(column, value) {
  if (DATE_COLUMN_KEYS.has(column.key)) return new Date(value).toLocaleString();
  return value;
}

function MasterDataTable({ route, columns }) {
  const { data, isLoading, error } = useMasterDataTable(route);

  if (isLoading) return <p className={styles.status}>Loading…</p>;
  if (error) return <p className={styles.statusError}>Could not load this table: {error.message}</p>;
  if (data.length === 0) return <p className={styles.status}>No records yet. Add one via the MCP tools.</p>;

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
        {data.map((row) => (
          <tr key={row.id}>
            {columns.map((column) => (
              <td key={column.key}>{formatCell(column, row[column.key])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default MasterDataTable;
