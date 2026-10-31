import PropTypes from 'prop-types';
import { useCountUp } from '../../hooks/useCountUp';
import { formatCount } from '../../lib/formatCount';

function AnimatedNumber({ value }) {
  return formatCount(useCountUp(value));
}

AnimatedNumber.propTypes = {
  value: PropTypes.number,
};

export default AnimatedNumber;
