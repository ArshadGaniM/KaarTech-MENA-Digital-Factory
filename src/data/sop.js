// The headings every service's SOP screen shows, in this order. Each starts
// empty and reads "Content to be added" until its text is given.
export const SOP_SECTIONS = [
  { id: 'objective', title: 'Objective' },
  { id: 'benefits', title: 'Benefits' },
  { id: 'operating-model', title: 'Operating model' },
  { id: 'entry-criteria', title: 'Entry criteria' },
  { id: 'exit-criteria', title: 'Exit criteria' },
  { id: 'scope', title: 'Scope' },
  { id: 'roles-and-responsibilities', title: 'Roles and responsibilities' },
  { id: 'process-steps', title: 'Process steps' },
  { id: 'tools-and-templates', title: 'Tools and templates' },
  { id: 'measures-of-success', title: 'Measures of success' },
];

// Text for a service's headings, keyed by its department code, then by heading id:
//   'DEPT-001': { objective: 'Text for the objective.' }
// A heading with no text here shows "Content to be added".
export const SOP_CONTENT = {};

export const sopHash = (code) => `#sop/${encodeURIComponent(code)}`;
const SOP_HASH_PREFIX = '#sop/';
// Null for any hash that is not an SOP link: another section, a bare "#sop/", or a broken escape.
// App then shows the portal home page instead of an SOP screen.
export const codeFromSopHash = (hash) => {
  if (!hash.startsWith(SOP_HASH_PREFIX)) return null;
  try {
    return decodeURIComponent(hash.slice(SOP_HASH_PREFIX.length)) || null;
  } catch {
    return null;
  }
};
