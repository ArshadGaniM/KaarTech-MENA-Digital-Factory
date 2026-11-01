const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// Costs are monthly, in USD. null means "no figure" and shows as a dash.
export const formatUsd = (amount) => (amount === null || amount === undefined ? '—' : usd.format(amount));

// "2026-12-05" -> "5 Dec 2026". Read as a calendar day, so the viewer's time
// zone cannot move it.
export function formatDay(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
