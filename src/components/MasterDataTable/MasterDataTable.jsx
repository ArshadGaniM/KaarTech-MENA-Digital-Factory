import { useState } from 'react';
import PropTypes from 'prop-types';
import { useMasterDataTable } from '../../hooks/useMasterDataTable';
import AddRecordModal from '../AddRecordModal';
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

function MasterDataTable({ route, columns, singularLabel }) {
  const { data, isLoading, error, refetch } = useMasterDataTable(route);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const labelByKey = Object.fromEntries(columns.map((column) => [column.key, column.label]));

  function handleCreated() {
    setIsAddOpen(false);
    refetch();
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.addButton} onClick={() => setIsAddOpen(true)}>
          Add {singularLabel}
        </button>
      </div>

      {isLoading ? (
        <p className={styles.status} role="status" aria-live="polite">
          Loading…
        </p>
      ) : error ? (
        <p className={styles.statusError} role="alert">
          Could not load this table: {error.message}
        </p>
      ) : (
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
                  No records yet. Add one above.
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
      )}

      {isAddOpen && (
        <AddRecordModal
          route={route}
          singularLabel={singularLabel}
          labelByKey={labelByKey}
          onClose={() => setIsAddOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

MasterDataTable.propTypes = {
  route: PropTypes.string.isRequired,
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  singularLabel: PropTypes.string.isRequired,
};

export default MasterDataTable;
