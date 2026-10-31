// The CSS class of a status: full -> cardFull. Keeps the camelCase naming
// the style rules ask for while the status values stay plain words.
export const statusClass = (styles, status) => styles[`card${status[0].toUpperCase()}${status.slice(1)}`];
