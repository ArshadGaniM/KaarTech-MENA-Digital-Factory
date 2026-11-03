import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { fetchMasterDataTable } from '../../lib/masterDataApi';
import { assignSeat, isModuleLeadSeat, latestSeatedEnd, todayIso } from '../../lib/teamActions';
import styles from './ControlCenter.module.css';

const SEARCH_LIMIT = 8;

// Fills one vacant seat. Start is today and End is the latest end among the
// people already seated in the team; both can be changed.
function AssignSeatForm({ seat, seats, onSaved, onCancel }) {
  const moduleLead = isModuleLeadSeat(seat);
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [person, setPerson] = useState(null);
  const [startDate, setStartDate] = useState(todayIso);
  // A team whose people have all ended would pre-fill an end before today's start.
  const [endDate, setEndDate] = useState(() => {
    const latest = latestSeatedEnd(seats);
    return latest >= todayIso() ? latest : '';
  });
  const [allocation, setAllocation] = useState('100');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const text = search.trim();
    if (text === '' || person) return undefined;
    let cancelled = false;
    fetchMasterDataTable('resources', { limit: SEARCH_LIMIT, query: text })
      .then(({ rows }) => {
        if (cancelled) return;
        setSearchError(null);
        setMatches(rows.filter((row) => row.markedDeleted !== 'Yes'));
        setSearched(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setMatches([]);
        setSearchError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [search, person]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!person || !startDate || !endDate) {
      setError({ message: 'Pick a person and give both a start date and an end date.', details: {} });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await assignSeat(seat, { employeeId: Number(person.employeeId), startDate, endDate, allocationPercentage: Number(allocation) });
      onSaved();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  const fieldMessages = Object.values(error?.details ?? {});

  return (
    <form className={styles.inlineForm} onSubmit={onSubmit} aria-label={`Assign ${seat.positionCode}`}>
      <p className={styles.inlineFormTitle}>
        Assign a person to {seat.positionName}
        <span className={styles.rowMeta}>{seat.positionCode}</span>
      </p>
      <div className={styles.formField}>
        <label htmlFor="assign-person">Person</label>
        <input
          id="assign-person"
          type="search"
          autoComplete="off"
          placeholder="Search by name or employee ID"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPerson(null);
            setMatches([]);
            setSearched(false);
            if (e.target.value.trim() === '') setSearchError(null);
          }}
        />
        {person ? (
          <p className={styles.rowMeta}>
            Selected: {person.name} ({person.employeeId})
          </p>
        ) : (
          search.trim() !== '' &&
          (matches.length > 0 ? (
            <ul className={styles.matchList} aria-label="People found">
              {matches.map((row) => (
                <li key={row.employeeId}>
                  <button
                    type="button"
                    onClick={() => {
                      setPerson(row);
                      setSearch(`${row.name} (${row.employeeId})`);
                    }}
                  >
                    {row.name} ({row.employeeId})
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            searched && !searchError && <p className={styles.rowMeta}>No people found</p>
          ))
        )}
        {searchError && <p className={styles.fieldError} role="alert">Could not search people: {searchError.message}</p>}
      </div>
      <div className={styles.formField}>
        <label htmlFor="assign-start">Start date</label>
        <input id="assign-start" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <div className={styles.formField}>
        <label htmlFor="assign-end">End date</label>
        <input id="assign-end" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>
      {!moduleLead && (
        <div className={styles.formField}>
          <label htmlFor="assign-allocation">Allocation %</label>
          <input
            id="assign-allocation"
            type="number"
            min="0.01"
            max="100"
            step="any"
            required
            value={allocation}
            onChange={(e) => setAllocation(e.target.value)}
          />
        </div>
      )}
      {error && (
        <div className={styles.fieldError} role="alert">
          <p>{error.message}</p>
          {fieldMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}
      <div className={styles.inlineActions}>
        <button type="button" className={styles.editAssignment} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className={styles.addAssignment} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

AssignSeatForm.propTypes = {
  seat: PropTypes.shape({ positionCode: PropTypes.string.isRequired, positionName: PropTypes.string.isRequired }).isRequired,
  seats: PropTypes.arrayOf(PropTypes.shape({ endDate: PropTypes.string })).isRequired,
  onSaved: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default AssignSeatForm;
