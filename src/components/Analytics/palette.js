const PALETTE = Array.from({ length: 8 }, (_, i) => `var(--color-chart-${i + 1})`);

export const colorAt = (index) => PALETTE[index % PALETTE.length];
