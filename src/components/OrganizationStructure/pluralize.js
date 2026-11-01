export const pluralNoun = (count, noun) => (count === 1 ? noun : `${noun}s`);
export const pluralize = (count, noun) => `${count} ${pluralNoun(count, noun)}`;
