import { describe, expect, it } from 'vitest';
import { countWord } from './numberWords';

describe('countWord', () => {
  it.each([[1, 'One'], [7, 'Seven'], [8, 'Eight'], [12, 'Twelve']])('writes %i as %s', (count, word) => {
    expect(countWord(count)).toBe(word);
  });

  it('uses digits past twelve', () => {
    expect(countWord(13)).toBe('13');
  });
});
