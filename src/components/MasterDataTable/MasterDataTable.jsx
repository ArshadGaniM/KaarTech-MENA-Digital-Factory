import { useState } from 'react';
import PropTypes from 'prop-types';
import { useMasterDataTable } from '../../hooks/useMasterDataTable';
import { deleteRecord } from '../../lib/masterDataApi';
import AddRecordModal from '../AddRecordModal';
import DeleteRecordModal from '../DeleteRecordModal';
import styles from './MasterDataTable.module.css';

const DATE_COLUMN_KEYS = new Set(['createdAt', 'updatedAt']);
const ENUM_COLUMN_KEYS = new Set(['locationType']);

const DEFAULT_COLUMN_WIDTH = 180;
const ACTIONS_COLUMN_WIDTH = 120;
const MIN_COLUMN_WIDTH = 72;

function capitalize(value) {
  return typeof value === 'string' ? value.replace(/\b\w/g, (letter) => letter.toUpperCase()) : value;
}

function formatCell(column, value) {
  if (DATE_COLUMN_KEYS.has(column.key)) return new Date(value).toLocaleString();
  if (ENUM_COLUMN_KEYS.has(column.key)) return capitalize(value);
  return value;
}

// Drag-to-resize for every table's columns (FEAT-18). A plain
// `<colgroup>`/`table-layout: fixed` pair, not a table library — each
// column's width lives in state keyed by its column key, and a column's
// `<th>` carries a thin drag handle on its trailing edge. `MasterDataTable`
// remounts per table (AppShell renders it with `key={activeItem.id}`), so
// switching sections naturally resets widths back to the default — no
// explicit reset effect needed.
function useColumnWidths(columns) {
  const [widths, setWidths] = useState(() =>
    Object.fromEntries(columns.map((column) => [column.key, DEFAULT_COLUMN_WIDTH]))
  );

  function startResize(event, key) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widths[key] ?? DEFAULT_COLUMN_WIDTH;

    function onMove(moveEvent) {
      const next = Math.max(MIN_COLUMN_WIDTH, startWidth + (moveEvent.clientX - startX));
      setWidths((prev) => ({ ...prev, [key]: next }));
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return { widths, startResize };
}

function MasterDataTable({ route, columns, singularLabel }) {
  const { data, total, page, totalPages, setPage, isLoading, error, refetch } = useMasterDataTable(route);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [rowDeleteError, setRowDeleteError] = useState(null);
  // A Set, not a single id — two different rows can be deleting
  // concurrently (user clicks Delete on row A, then row B before A's
  // request resolves), and a scalar would let one request's `finally`
  // clear the other's in-flight indicator (gate finding, code-reviewer).
  const [deletingRowIds, setDeletingRowIds] = useState(() => new Set());
  const labelByKey = Object.fromEntries(columns.map((column) => [column.key, column.label]));
  const { widths, startResize } = useColumnWidths(columns);

  function handleCreated() {
    setIsAddOpen(false);
    refetch();
  }

  function handleDeleted() {
    setIsDeleteOpen(false);
    refetch();
  }

  // FEAT-15: per-row delete — the row already carries its own internal
  // id, so this skips the code/id lookup the toolbar's Delete popup does.
  // window.confirm is a deliberately minimal confirmation step (Simplicity
  // First, CLAUDE.md §1) rather than a second modal for the same action.
  async function handleRowDelete(row) {
    if (!window.confirm(`Mark this ${singularLabel.toLowerCase()} record as deleted?`)) return;
    setRowDeleteError(null);
    setDeletingRowIds((prev) => new Set(prev).add(row.id));
    try {
      await deleteRecord(route, row.id);
      refetch();
    } catch (err) {
      setRowDeleteError(err.message);
    } finally {
      setDeletingRowIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.addButton} onClick={() => setIsAddOpen(true)}>
          Add {singularLabel}
        </button>
        <button type="button" className={styles.deleteToolbarButton} onClick={() => setIsDeleteOpen(true)}>
          Delete {singularLabel}
        </button>
      </div>

      {rowDeleteError && (
        <p className={styles.statusError} role="alert">
          {rowDeleteError}
        </p>
      )}

      {isLoading ? (
        <p className={styles.status} role="status" aria-live="polite">
          Loading…
        </p>
      ) : error ? (
        <p className={styles.statusError} role="alert">
          Could not load this table: {error.message}
        </p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <colgroup>
              {columns.map((column) => (
                <col key={column.key} style={{ width: widths[column.key] }} />
              ))}
              <col style={{ width: ACTIONS_COLUMN_WIDTH }} />
            </colgroup>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} title={column.label}>
                    <span className={styles.headerLabel}>{column.label}</span>
                    <span
                      className={styles.resizeHandle}
                      onMouseDown={(e) => startResize(e, column.key)}
                      role="presentation"
                      aria-hidden="true"
                    />
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td className={styles.status} colSpan={columns.length + 1}>
                    No records yet. Add one above.
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id}>
                    {columns.map((column) => (
                      <td key={column.key} title={String(row[column.key] ?? '')}>
                        {formatCell(column, row[column.key])}
                      </td>
                    ))}
                    <td>
                      {row.markedDeleted === 'Yes' ? (
                        <span className={styles.status}>Deleted</span>
                      ) : (
                        <button
                          type="button"
                          className={styles.rowDeleteButton}
                          onClick={() => handleRowDelete(row)}
                          disabled={deletingRowIds.has(row.id)}
                        >
                          {deletingRowIds.has(row.id) ? 'Deleting…' : 'Delete'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !error && (
        <div className={styles.pagination}>
          <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1}>
            Previous
          </button>
          <span className={styles.pageInfo}>
            Page {page} of {totalPages} ({total} total)
          </span>
          <button type="button" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
            Next
          </button>
        </div>
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

      {isDeleteOpen && (
        <DeleteRecordModal
          route={route}
          singularLabel={singularLabel}
          onClose={() => setIsDeleteOpen(false)}
          onDeleted={handleDeleted}
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
