// Practice codes look like PRAC-007. The number picks one of the ten practice
// tokens in index.css, so a practice keeps its colour wherever it appears.
export function practiceColor(code) {
  const number = Number(/(\d+)$/.exec(code)?.[1]);
  return number >= 1 && number <= 10 ? `var(--color-practice-${number})` : 'var(--color-practice-none)';
}
