import '@testing-library/jest-dom/vitest';

// jsdom has no matchMedia. Default to "reduce motion" so animated numbers and
// charts render their final values immediately; tests of the animation
// itself replace this.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
}
