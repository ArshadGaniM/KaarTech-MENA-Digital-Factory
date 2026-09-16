import { useMasterDataTable } from '../../hooks/useMasterDataTable';
import styles from './MasterDataTable.module.css';

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function MasterDataTable({ route }) {
  const { data, isLoading, error } = useMasterDataTable(route);

  if (isLoading) return <p className={styles.status}>Loading…</p>;
  if (error) return <p className={styles.statusError}>Could not load this table: {error.message}</p>;
  if (data.length === 0) return <p className={styles.status}>No records yet. Add one via the MCP tools.</p>;

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Name</th>
          <th>Created</th>
          <th>Last modified</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id}>
            <td>{row.name}</td>
            <td>{formatDate(row.createdAt)}</td>
            <td>{formatDate(row.updatedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default MasterDataTable;
