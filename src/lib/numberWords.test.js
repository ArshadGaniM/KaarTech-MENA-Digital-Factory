import { describe, expect, it } from 'vitest';
import { countWord } from './numberWords';

describe('countWord', () => {
  it.each([[1, 'One'], [7, 'Seven'], [8, 'Eight'], [12, 'Twelve'], [13, 'Thirteen'], [20, 'Twenty']])('writes %i as %s', (count, word) => {
    expect(countWord(count)).toBe(word);
  });

  it('uses digits past twenty', () => {
    expect(countWord(21)).toBe('21');
  });
});
