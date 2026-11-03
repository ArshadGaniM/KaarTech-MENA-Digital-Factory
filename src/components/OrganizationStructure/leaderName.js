import { initialsOf } from './initialsOf';

// A leader seat whose name is still 'TBD' keeps the TBD avatar and the "Name TBD" tag.
export const isNamed = (name) => Boolean(name) && name !== 'TBD';
export const avatarText = (name) => (isNamed(name) ? initialsOf(name) : 'TBD');
export const nameTag = (name) => (isNamed(name) ? name : `Name ${name}`);
