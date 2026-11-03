const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// Costs are monthly, in USD. null means "no figure" and shows as a dash.
export const formatUsd = (amount) => (amount === null || amount === undefined ? '—' : usd.format(amount));

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-12-05" -> "5 Dec 2026". Read as a calendar day, so the viewer's time
// zone cannot move it. Month names are fixed because newer locale data spells
// September "Sept".
export function formatDay(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${day} ${SHORT_MONTHS[month - 1]} ${year}`;
}
