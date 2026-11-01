import { describe, expect, it } from 'vitest';
import { SOP_SECTIONS, codeFromSopHash, sopHash } from './sop';

describe('SOP headings', () => {
  it('are the ten the owner approved, in order, with unique ids', () => {
    expect(SOP_SECTIONS.map((section) => section.title)).toEqual([
      'Objective',
      'Benefits',
      'Operating model',
      'Entry criteria',
      'Exit criteria',
      'Scope',
      'Roles and responsibilities',
      'Process steps',
      'Tools and templates',
      'Measures of success',
    ]);
    expect(new Set(SOP_SECTIONS.map((section) => section.id)).size).toBe(10);
  });
});

describe('SOP links', () => {
  it('round-trips a department code', () => {
    expect(codeFromSopHash(sopHash('DEPT-001'))).toBe('DEPT-001');
    expect(codeFromSopHash(sopHash('A B/C'))).toBe('A B/C');
  });

  it.each(['', '#services', '#sop', '#dashboard'])('does not read %j as an SOP link', (hash) => {
    expect(codeFromSopHash(hash)).toBeNull();
  });

  it('does not throw on a broken escape', () => {
    expect(codeFromSopHash('#sop/%E0%A4%A')).toBeNull();
  });
});
