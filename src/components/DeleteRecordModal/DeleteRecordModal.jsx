import { useState } from 'react';
import PropTypes from 'prop-types';
import { deleteRecord, fetchAllMasterDataTableRows } from '../../lib/masterDataApi';
import { useEntityRelationships } from '../../hooks/useEntityRelationships';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import styles from './DeleteRecordModal.module.css';

// FEAT-15: the label for the "Code or ID" field varies by table — a
// table with a business identity (auto-generated code, or a
// caller-supplied unique field like employeeId) should prompt for that;
// a table with no business identity (identity: "none") has only its
// internal row id to match against.
function identityLabel(identity) {
  if (identity?.type === 'auto-generated') return 'Code';
  if (identity?.type === 'caller-supplied-unique') return identity.field;
  return 'Record ID';
}

function findActiveMatch(rows, identityKey, value) {
  const needle = value.trim().toLowerCase();
  return rows.find(
    (row) => row.markedDeleted !== 'Yes' && String(row[identityKey] ?? '').trim().toLowerCase() === needle
  );
}

function DeleteRecordModal({ route, singularLabel, onClose, onDeleted }) {
  const { data: entities, isLoading: entitiesLoading, error: entitiesError } = useEntityRelationships();
  const tableEntity = entities?.find((entity) => entity.route === route);
  const identity = tableEntity?.identity;
  const identityKey = identity?.type === 'none' ? 'id' : identity?.field;
  const label = identityLabel(identity);

  // The visible table only ever holds one page (FEAT-18) — a record the
  // user wants to delete by code/ID could be on any page, so this fetches
  // every row for `route` independently rather than trusting whatever
  // page happened to be on screen when the modal opened.
  const {
    data,
    isLoading: dataLoading,
    error: dataError,
  } = useAsyncResource(() => fetchAllMasterDataTableRows(route), [route]);

  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loading = entitiesLoading || dataLoading;
  const loadError = entitiesError || dataError;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const match = findActiveMatch(data ?? [], identityKey, value);
    if (!match) {
      setError(`No active ${singularLabel.toLowerCase()} found with ${label} "${value}".`);
      return;
    }

    setSubmitting(true);
    try {
      await deleteRecord(route, match.id);
      onDeleted();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-record-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="delete-record-title">Delete {singularLabel}</h2>

        {loading ? (
          <p role="status" aria-live="polite">
            Loading…
          </p>
        ) : loadError ? (
          <p role="alert">Could not load form: {loadError.message}</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className={styles.formRow}>
              <label htmlFor="delete-record-value">{label}</label>
              <input
                id="delete-record-value"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className={styles.formError} role="alert">
                {error}
              </p>
            )}

            <div className={styles.actions}>
              <button type="button" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className={styles.deleteButton} disabled={submitting}>
                {submitting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

DeleteRecordModal.propTypes = {
  route: PropTypes.string.isRequired,
  singularLabel: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onDeleted: PropTypes.func.isRequired,
};

export default DeleteRecordModal;
