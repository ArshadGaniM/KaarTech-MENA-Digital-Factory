import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useMasterDataTable } from '../../hooks/useMasterDataTable';
import { useColumnWidths } from '../../hooks/useColumnWidths';
import { deleteRecord, restoreRecord } from '../../lib/masterDataApi';
import RecordFormModal from '../RecordFormModal';
import DeleteRecordModal from '../DeleteRecordModal';
import styles from './MasterDataTable.module.css';

const DATE_COLUMN_KEYS = new Set(['createdAt', 'updatedAt']);
const ENUM_COLUMN_KEYS = new Set(['locationType']);

const ACTIONS_COLUMN_WIDTH = 190;
// How long typing must pause before the search runs, so a request is not sent per keystroke.
const SEARCH_DEBOUNCE_MS = 300;

function capitalize(value) {
  return typeof value === 'string' ? value.replace(/\b\w/g, (letter) => letter.toUpperCase()) : value;
}

function formatCell(column, value) {
  if (DATE_COLUMN_KEYS.has(column.key)) return new Date(value).toLocaleString();
  if (ENUM_COLUMN_KEYS.has(column.key)) return capitalize(value);
  return value;
}

function MasterDataTable({ route, columns, singularLabel }) {
  // FEAT-24: `searchText` is what the box shows; `searchTerm` is what has been
  // sent to the backend once typing paused. Switching table clears both.
  const [searchText, setSearchText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchRoute, setSearchRoute] = useState(route);
  if (searchRoute !== route) {
    setSearchRoute(route);
    setSearchText('');
    setSearchTerm('');
  }
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchText.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  const { data, total, page, totalPages, setPage, isLoading, error, refetch, reload } = useMasterDataTable(route, searchTerm);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  // FEAT-19: the row being edited (null = the edit modal is closed).
  const [editingRow, setEditingRow] = useState(null);
  // Errors from row actions (delete / undo delete), one per row id: a
  // single shared message let a second failure overwrite the first, and
  // starting any new action wipe an unread one (gate finding,
  // silent-failure-hunter). Starting an action on a row clears only that
  // row's own earlier error.
  const [rowErrors, setRowErrors] = useState({});
  // Sets, not single ids — two different rows can be in flight at once
  // (user clicks Delete on row A, then row B before A's request resolves),
  // and a scalar would let one request's `finally` clear the other's
  // in-flight indicator (gate finding, code-reviewer, FEAT-15).
  const [deletingRowIds, setDeletingRowIds] = useState(() => new Set());
  const [restoringRowIds, setRestoringRowIds] = useState(() => new Set());
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

  // An edit doesn't change the row count, so stay on the current page.
  function handleEdited() {
    setEditingRow(null);
    reload();
  }

  // The shared shape of a per-row action: mark the row in flight in `setIds`,
  // run it, and record a failure against that row only.
  async function runRowAction(row, setIds, action) {
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[row.id];
      return next;
    });
    setIds((prev) => new Set(prev).add(row.id));
    try {
      await action();
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [row.id]: `${row[columns[0].key]}: ${err.message}` }));
    } finally {
      setIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  }

  // FEAT-15: per-row delete — the row already carries its own internal
  // id, so this skips the code/id lookup the toolbar's Delete popup does.
  // window.confirm is a deliberately minimal confirmation step (Simplicity
  // First, CLAUDE.md §1) rather than a second modal for the same action.
  async function handleRowDelete(row) {
    if (!window.confirm(`Mark this ${singularLabel.toLowerCase()} record as deleted?`)) return;
    await runRowAction(row, setDeletingRowIds, async () => {
      await deleteRecord(route, row.id);
      refetch();
    });
  }

  // FEAT-19: undo of the above. No confirm() — restoring is itself the
  // safe direction (nothing is lost if it was a misclick; Delete undoes
  // it). The backend refuses if this row references a record that is
  // itself still deleted; that message shows against this row.
  async function handleRowRestore(row) {
    await runRowAction(row, setRestoringRowIds, async () => {
      await restoreRecord(route, row.id);
      reload();
    });
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <input
            type="search"
            className={styles.searchInput}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={`Search ${singularLabel.toLowerCase()} records`}
            aria-label={`Search ${singularLabel.toLowerCase()} records`}
            maxLength={100}
          />
          {searchText !== '' && (
            <button type="button" className={styles.searchClear} onClick={() => setSearchText('')}>
              Clear
            </button>
          )}
        </div>
        <button type="button" className={styles.addButton} onClick={() => setIsAddOpen(true)}>
          Add {singularLabel}
        </button>
        <button type="button" className={styles.deleteToolbarButton} onClick={() => setIsDeleteOpen(true)}>
          Delete {singularLabel}
        </button>
      </div>

      {Object.entries(rowErrors).map(([rowId, message]) => (
        <p key={rowId} className={styles.statusError} role="alert">
          {message}
        </p>
      ))}

      {isLoading && data === null ? (
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
                    {searchTerm ? `No records match "${searchTerm}".` : 'No records yet. Add one above.'}
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
                        <button
                          type="button"
                          className={styles.rowRestoreButton}
                          onClick={() => handleRowRestore(row)}
                          disabled={restoringRowIds.has(row.id)}
                        >
                          {restoringRowIds.has(row.id) ? 'Restoring…' : 'Undo delete'}
                        </button>
                      ) : (
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            className={styles.rowEditButton}
                            onClick={() => setEditingRow(row)}
                            disabled={deletingRowIds.has(row.id) || restoringRowIds.has(row.id)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={styles.rowDeleteButton}
                            onClick={() => handleRowDelete(row)}
                            disabled={deletingRowIds.has(row.id)}
                          >
                            {deletingRowIds.has(row.id) ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {!error && data !== null && (
        <div className={styles.pagination}>
          <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1 || isLoading}>
            Previous
          </button>
          <span className={styles.pageInfo}>
            Page {page} of {totalPages} ({total} total){isLoading ? ' — updating…' : ''}
          </span>
          <button type="button" onClick={() => setPage(page + 1)} disabled={page >= totalPages || isLoading}>
            Next
          </button>
        </div>
      )}

      {isAddOpen && (
        <RecordFormModal
          route={route}
          singularLabel={singularLabel}
          labelByKey={labelByKey}
          onClose={() => setIsAddOpen(false)}
          onSaved={handleCreated}
        />
      )}

      {editingRow && (
        <RecordFormModal
          key={editingRow.id}
          route={route}
          singularLabel={singularLabel}
          labelByKey={labelByKey}
          record={editingRow}
          onClose={() => setEditingRow(null)}
          onSaved={handleEdited}
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
