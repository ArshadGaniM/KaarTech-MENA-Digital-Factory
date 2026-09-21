import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { createRecord, fetchMasterDataTable } from '../../lib/masterDataApi';
import { useEntityRelationships } from '../../hooks/useEntityRelationships';
import styles from './AddRecordModal.module.css';

// A pick-list option's label — the referenced row's identity value alone
// isn't always readable on its own (e.g. a bare "TEAM-001"), so this adds
// a descriptive field when one of the common ones is present. Deliberately
// NOT exhaustive/table-specific — a generic best-effort, not a hardcoded
// per-table mapping, since this modal is built once and reused for every
// table (FEAT-14's whole point, same as FEAT-12's Entity Relationship page).
function optionLabel(row, identityKey) {
  const identityValue = row[identityKey];
  const descriptive = row.name ?? row.projectName ?? null;
  return descriptive ? `${identityValue} — ${descriptive}` : String(identityValue);
}

function FieldControl({ field, label, value, onChange, pickListOptions, pickListLoading }) {
  const inputId = `add-record-field-${field.key}`;

  if (field.references) {
    return (
      <select
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        disabled={pickListLoading}
      >
        <option value="">{pickListLoading ? 'Loading…' : `Select ${label}`}</option>
        {(pickListOptions ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.values) {
    return (
      <select id={inputId} value={value} onChange={(e) => onChange(e.target.value)} required={field.required}>
        <option value="">{`Select ${label}`}</option>
        {field.values.map((allowedValue) => (
          <option key={allowedValue} value={allowedValue}>
            {allowedValue}
          </option>
        ))}
      </select>
    );
  }

  const inputType = field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text';
  return (
    <input
      id={inputId}
      type={inputType}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={field.required}
      maxLength={field.maxLength}
    />
  );
}

FieldControl.propTypes = {
  field: PropTypes.shape({
    key: PropTypes.string.isRequired,
    type: PropTypes.string,
    required: PropTypes.bool,
    maxLength: PropTypes.number,
    values: PropTypes.arrayOf(PropTypes.string),
    references: PropTypes.shape({ table: PropTypes.string, route: PropTypes.string }),
  }).isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  pickListOptions: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string, label: PropTypes.string })),
  pickListLoading: PropTypes.bool,
};

function AddRecordModal({ route, singularLabel, labelByKey, onClose, onCreated }) {
  const { data: entities, isLoading: entitiesLoading, error: entitiesError } = useEntityRelationships();
  const tableEntity = entities?.find((entity) => entity.route === route);
  const fields = tableEntity?.fields ?? [];

  const [values, setValues] = useState({});
  const [pickLists, setPickLists] = useState({});
  const [pickListsLoading, setPickListsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Fetch every referenced table's current rows once the field list is
  // known, so every FK field's <select> is populated before the user can
  // submit — a field with no options yet still renders, just with only
  // the "Loading…" placeholder selectable until this resolves.
  useEffect(() => {
    if (!tableEntity) return;
    const referenceFields = fields.filter((field) => field.references?.route);
    if (referenceFields.length === 0) {
      setPickListsLoading(false);
      return;
    }

    let cancelled = false;
    setPickListsLoading(true);

    Promise.all(
      referenceFields.map(async (field) => {
        const referencedEntity = entities.find((entity) => entity.route === field.references.route);
        const identityKey = referencedEntity?.identity?.field;
        const rows = await fetchMasterDataTable(field.references.route);
        const options = identityKey
          ? rows
              .filter((row) => row.markedDeleted !== 'Yes')
              .map((row) => ({ value: String(row[identityKey]), label: optionLabel(row, identityKey) }))
          : [];
        return [field.key, options];
      })
    )
      .then((entries) => {
        if (!cancelled) setPickLists(Object.fromEntries(entries));
      })
      .catch((err) => {
        if (!cancelled) setSubmitError(err);
      })
      .finally(() => {
        if (!cancelled) setPickListsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fields`/`entities` are derived from the same fetch and stable once tableEntity resolves
  }, [tableEntity]);

  if (entitiesLoading || entitiesError || !tableEntity) {
    return (
      <div className={styles.overlay} role="presentation" onClick={onClose}>
        <div
          className={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-label={`Add ${singularLabel}`}
          onClick={(e) => e.stopPropagation()}
        >
          {entitiesError ? (
            <p role="alert">Could not load the form: {entitiesError.message}</p>
          ) : (
            <p role="status" aria-live="polite">
              Loading form…
            </p>
          )}
          <div className={styles.actions}>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  function handleChange(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});

    const body = {};
    for (const field of fields) {
      const raw = values[field.key];
      if (raw === undefined || raw === '') continue;
      body[field.key] = field.type === 'number' ? Number(raw) : raw;
    }

    try {
      await createRecord(route, body);
      onCreated();
    } catch (err) {
      setSubmitError(err);
      setFieldErrors(err.details ?? {});
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
        aria-labelledby="add-record-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-record-title">Add {singularLabel}</h2>
        <form onSubmit={handleSubmit}>
          {fields.map((field) => {
            const label = labelByKey[field.key] ?? field.key;
            return (
              <div key={field.key} className={styles.formRow}>
                <label htmlFor={`add-record-field-${field.key}`}>
                  {label}
                  {field.required ? ' *' : ''}
                </label>
                <FieldControl
                  field={field}
                  label={label}
                  value={values[field.key] ?? ''}
                  onChange={(value) => handleChange(field.key, value)}
                  pickListOptions={pickLists[field.key]}
                  pickListLoading={field.references ? pickListsLoading : false}
                />
                {fieldErrors[field.key] && <p className={styles.fieldError}>{fieldErrors[field.key]}</p>}
              </div>
            );
          })}

          {submitError && !Object.keys(fieldErrors).length && (
            <p className={styles.formError} role="alert">
              {submitError.message}
            </p>
          )}

          <div className={styles.actions}>
            <button type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" disabled={submitting || pickListsLoading}>
              {submitting ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

AddRecordModal.propTypes = {
  route: PropTypes.string.isRequired,
  singularLabel: PropTypes.string.isRequired,
  labelByKey: PropTypes.objectOf(PropTypes.string).isRequired,
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func.isRequired,
};

export default AddRecordModal;
