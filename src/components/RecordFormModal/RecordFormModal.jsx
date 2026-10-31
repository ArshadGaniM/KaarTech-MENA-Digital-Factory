import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { createRecord, updateRecord, fetchAllMasterDataTableRows } from '../../lib/masterDataApi';
import { useEntityRelationships } from '../../hooks/useEntityRelationships';
import styles from './RecordFormModal.module.css';

// FEAT-19: one form for both "Add <Entity>" (FEAT-14) and "Edit <Entity>" —
// everything it renders comes from the same live field descriptor either
// way, so a separate edit modal would only be a second copy to keep in sync.
// Passing a `record` (a row from the table) switches it to edit mode.

// The string a form control holds for a row's value: an absent value is an
// empty control, and a date arrives from the API as a full ISO timestamp
// but an <input type="date"> only accepts YYYY-MM-DD.
function formValueOf(record, field) {
  const raw = record?.[field.key];
  if (raw === null || raw === undefined) return '';
  return field.type === 'date' ? String(raw).slice(0, 10) : String(raw);
}

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

function FieldControl({ field, label, value, onChange, pickListOptions, pickListLoading, locked }) {
  const inputId = `record-form-field-${field.key}`;
  const hasUnlistedValue =
    field.references &&
    !pickListLoading &&
    pickListOptions !== undefined &&
    value !== '' &&
    !pickListOptions.some((option) => option.value === value);

  if (field.references) {
    return (
      <select
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        disabled={pickListLoading || locked}
      >
        <option value="">{pickListLoading ? 'Loading…' : `Select ${label}`}</option>
        {(pickListOptions ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {/* The pick-list leaves out soft-deleted parents, but an existing
            row can still point at one (deleting a parent doesn't cascade).
            Without its own option the select would fall back to the blank
            placeholder and `required` would block saving *any* edit to that
            row (gate finding, code-reviewer/debugger). */}
        {hasUnlistedValue && (
          <option value={value}>{`${value} (deleted)`}</option>
        )}
      </select>
    );
  }

  if (field.values) {
    return (
      <select
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        disabled={locked}
      >
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
      disabled={locked}
      step={field.integer ? 1 : field.type === 'number' ? 'any' : undefined}
      min={field.min}
      max={field.max}
    />
  );
}

FieldControl.propTypes = {
  field: PropTypes.shape({
    key: PropTypes.string.isRequired,
    type: PropTypes.string,
    required: PropTypes.bool,
    maxLength: PropTypes.number,
    integer: PropTypes.bool,
    min: PropTypes.number,
    max: PropTypes.number,
    values: PropTypes.arrayOf(PropTypes.string),
    references: PropTypes.shape({ table: PropTypes.string, route: PropTypes.string }),
  }).isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  pickListOptions: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string, label: PropTypes.string })),
  pickListLoading: PropTypes.bool,
  locked: PropTypes.bool,
};

function RecordFormModal({ route, singularLabel, labelByKey, record, onClose, onSaved }) {
  const isEdit = record != null;
  const title = `${isEdit ? 'Edit' : 'Add'} ${singularLabel}`;
  const submitLabel = isEdit ? 'Save' : 'Add';
  const submittingLabel = isEdit ? 'Saving…' : 'Adding…';
  const { data: entities, isLoading: entitiesLoading, error: entitiesError } = useEntityRelationships();
  const tableEntity = entities?.find((entity) => entity.route === route);
  const fields = tableEntity?.fields ?? [];

  const [values, setValues] = useState({});
  const [pickLists, setPickLists] = useState({});
  const [pickListsLoading, setPickListsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  // Kept apart from submitError: handleSubmit clears that on every submit,
  // which would erase the only explanation of why a required pick-list is
  // empty (gate finding, silent-failure-hunter).
  const [pickListError, setPickListError] = useState(null);
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
        if (!identityKey) {
          throw new Error(`Cannot list ${field.references.route} options: it has no identity field to select by.`);
        }
        const rows = await fetchAllMasterDataTableRows(field.references.route);
        const options = rows
          .filter((row) => row.markedDeleted !== 'Yes')
          .map((row) => ({ value: String(row[identityKey]), label: optionLabel(row, identityKey) }));
        return [field.key, options];
      })
    )
      .then((entries) => {
        if (!cancelled) setPickLists(Object.fromEntries(entries));
      })
      .catch((err) => {
        if (!cancelled) setPickListError(err);
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
          aria-label={title}
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

  // What a control currently shows: the user's edit if they've made one
  // (even an edit to ''), otherwise the record's own value (edit mode) or
  // empty (add mode).
  function valueOf(field) {
    return values[field.key] ?? formValueOf(record, field);
  }

  // The caller-supplied identity (e.g. employeeId, projectId) is the row's
  // key — other tables' foreign keys point at it, so editing it in place is
  // not offered. An auto-generated code never appears in `fields` at all.
  const lockedKey =
    isEdit && tableEntity.identity?.type === 'caller-supplied-unique' ? tableEntity.identity.field : null;

  function handleChange(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});

    // Add sends every non-empty field. Edit sends only what actually
    // changed (PATCH is partial), and a field the user emptied is sent as an
    // explicit null so an optional value can really be cleared.
    const coerce = (field, raw) => (field.type === 'number' ? Number(raw) : raw);
    const body = {};
    for (const field of fields) {
      const raw = valueOf(field);
      if (isEdit) {
        if (raw === formValueOf(record, field)) continue;
        body[field.key] = raw === '' ? null : coerce(field, raw);
      } else if (raw !== '') {
        body[field.key] = coerce(field, raw);
      }
    }

    if (isEdit && Object.keys(body).length === 0) {
      setSubmitting(false);
      onClose();
      return;
    }

    try {
      await (isEdit ? updateRecord(route, record.id, body) : createRecord(route, body));
      onSaved();
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
        aria-labelledby="record-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="record-form-title">{title}</h2>
        <form onSubmit={handleSubmit}>
          {fields.map((field) => {
            const label = labelByKey[field.key] ?? field.key;
            return (
              <div key={field.key} className={styles.formRow}>
                <label htmlFor={`record-form-field-${field.key}`}>
                  {label}
                  {field.required ? ' *' : ''}
                </label>
                <FieldControl
                  field={field}
                  label={label}
                  value={valueOf(field)}
                  onChange={(value) => handleChange(field.key, value)}
                  pickListOptions={pickLists[field.key]}
                  pickListLoading={field.references ? pickListsLoading : false}
                  locked={field.key === lockedKey}
                />
                {fieldErrors[field.key] && <p className={styles.fieldError}>{fieldErrors[field.key]}</p>}
              </div>
            );
          })}

          {pickListError && (
            <p className={styles.formError} role="alert">
              Could not load the options for a selection field: {pickListError.message}
            </p>
          )}

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
              {submitting ? submittingLabel : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

RecordFormModal.propTypes = {
  route: PropTypes.string.isRequired,
  singularLabel: PropTypes.string.isRequired,
  labelByKey: PropTypes.objectOf(PropTypes.string).isRequired,
  record: PropTypes.shape({ id: PropTypes.string.isRequired }),
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

export default RecordFormModal;
