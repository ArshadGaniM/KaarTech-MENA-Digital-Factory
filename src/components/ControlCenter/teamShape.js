import PropTypes from 'prop-types';
import { STATUS_LABELS } from '../../lib/hours';

export const teamShape = PropTypes.shape({
  code: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  competencies: PropTypes.arrayOf(PropTypes.string).isRequired,
  memberCount: PropTypes.number.isRequired,
  seatCount: PropTypes.number.isRequired,
  vacantSeatCount: PropTypes.number.isRequired,
  availableHours: PropTypes.number.isRequired,
  allocatedHours: PropTypes.number.isRequired,
  utilizedHours: PropTypes.number.isRequired,
  utilizationPercent: PropTypes.number.isRequired,
  status: PropTypes.oneOf(Object.keys(STATUS_LABELS)).isRequired,
});
