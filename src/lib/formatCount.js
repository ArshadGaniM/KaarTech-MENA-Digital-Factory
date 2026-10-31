const numberFormat = new Intl.NumberFormat('en-US');

// null means "could not be loaded", which must not read as zero.
export function formatCount(count) {
  return count === null ? '—' : numberFormat.format(count);
}
