import PropTypes from 'prop-types';
import { formatDay, formatUsd } from '../../lib/money';
import { isSeatRunning, todayIso } from '../../lib/teamActions';
import AssignSeatForm from './AssignSeatForm';
import IconButton from './IconButton';
import styles from './ControlCenter.module.css';

const percent = (value) => (value === null ? '—' : `${value}%`);

function CostCell({ value }) {
  return <td className={styles.numeric}>{formatUsd(value)}</td>;
}

CostCell.propTypes = { value: PropTypes.number };

const seatShape = PropTypes.shape({
  positionCode: PropTypes.string.isRequired,
  positionName: PropTypes.string.isRequired,
  counted: PropTypes.bool,
  employeeId: PropTypes.number,
  employeeName: PropTypes.string,
  deploymentId: PropTypes.string,
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  allocationPercentage: PropTypes.number,
  availablePercentage: PropTypes.number,
  plannedResourceCost: PropTypes.number,
  actualResourceCost: PropTypes.number,
  allocatedResourceCost: PropTypes.number,
  costSource: PropTypes.string,
});

// One seat: its row, and under a vacant seat the Assign form when it is open.
function SeatRows({ seat, seats, assigning, busy, onAssign, onCancelAssign, onUnassign, onDelete, onSaved }) {
  const vacant = seat.employeeId === null;
  const canUnassign = !vacant && isSeatRunning(seat, todayIso());
  return (
    <>
      <tr className={vacant ? styles.vacantRow : undefined}>
        <th scope="row">
          {seat.positionName}
          <IconButton icon="trash" label="Delete Position" onClick={onDelete} />
          <span className={styles.rowMeta}>{seat.positionCode}</span>
        </th>
        <td>
          {seat.employeeName ?? 'Vacant'}
          {vacant && (
            <IconButton icon="plus" label="Assign" onClick={onAssign} disabled={assigning} />
          )}
          {!vacant && !canUnassign && seat.endDate && <span className={styles.rowMeta}>Ended {formatDay(seat.endDate)}</span>}
          {canUnassign && (
            <IconButton
              icon="close"
              label="Unassign"
              onClick={onUnassign}
              disabled={busy || !seat.deploymentId}
              title={seat.deploymentId ? undefined : 'Reload after the server update'}
            />
          )}
        </td>
        <td className={styles.numeric}>{percent(seat.allocationPercentage)}</td>
        <td className={styles.numeric}>{percent(seat.availablePercentage)}</td>
        <CostCell value={seat.plannedResourceCost} />
        <CostCell value={seat.actualResourceCost} />
        <td className={styles.numeric}>
          {formatUsd(seat.allocatedResourceCost)}
          {seat.costSource && <span className={styles.sourceTag}>{seat.costSource}</span>}
        </td>
      </tr>
      {assigning && (
        <tr>
          <td colSpan={7}>
            <AssignSeatForm seat={seat} seats={seats} onCancel={onCancelAssign} onSaved={onSaved} />
          </td>
        </tr>
      )}
    </>
  );
}

SeatRows.propTypes = {
  seat: seatShape.isRequired,
  seats: PropTypes.arrayOf(seatShape).isRequired,
  assigning: PropTypes.bool.isRequired,
  busy: PropTypes.bool.isRequired,
  onAssign: PropTypes.func.isRequired,
  onCancelAssign: PropTypes.func.isRequired,
  onUnassign: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

export default SeatRows;
