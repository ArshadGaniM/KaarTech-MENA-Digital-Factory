import { useState } from 'react';
import { currentMonth, shiftMonth } from '../lib/months';

// The month range of a chart tab: from two months back to six ahead, and a
// focus month that always stays inside the range. Moving one end past the
// other drags the other end along.
export function useMonthRange() {
  const base = currentMonth();
  const [from, setFromMonth] = useState(shiftMonth(base, -2));
  const [to, setToMonth] = useState(shiftMonth(base, 6));
  const [focusChoice, setFocus] = useState(base);
  const focus = focusChoice < from ? from : focusChoice > to ? to : focusChoice;
  return {
    base,
    from,
    to,
    focus,
    setFocus,
    setFrom: (month) => {
      setFromMonth(month);
      if (month > to) setToMonth(month);
    },
    setTo: (month) => {
      setToMonth(month);
      if (month < from) setFromMonth(month);
    },
  };
}
