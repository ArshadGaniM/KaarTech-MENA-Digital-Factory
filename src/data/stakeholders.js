// The initiative's stakeholders, as the owner gave them (1 Nov 2026). One list
// feeds both the Stakeholder Matrix table and the Initiative Org Structure
// diagram in the Charter. Rows with no name are open seats the owner will fill.

export const ROLE = {
  sponsor: 'Initiative Sponsor',
  owner: 'Initiative Owner',
  coOwner: 'Initiative Co-owner',
  trackOwner: 'Initiative Track Owner',
  trackCoOwner: 'Initiative Track Co-owner',
  member: 'Initiative Member',
};

export const TRACKS = [
  'Development & Enhancement Projects',
  'SAP Implementation & Rollout Projects',
  'Managed Services Projects',
];

const VERTICALS = ['Platinum', 'Services', 'EOG', 'A&D'];

const person = (name, designation, role, track = null) => ({ name, designation, role, track });

const NAMED = [
  person('Irfan Ahmed', 'COO MENA', ROLE.sponsor),
  person('Arshad Gani M', 'Delivery Manager - Onsite, Platinum, MENA', ROLE.owner),
  person('Dinesh V', 'Delivery Manager - Onsite, Platinum, MENA', ROLE.member),
  person('Mohammed Ibrahim S', 'Delivery Manager - Offshore, Platinum, MENA', ROLE.coOwner),
  person('Sudhir S', 'Delivery Manager - Onsite, Services, MENA', ROLE.member),
  person('Siddarth S', 'Delivery Manager - Offshore, Services, MENA', ROLE.member),
  person('Dhineshraj', 'Delivery Manager - Onsite, EOG, MENA', ROLE.member),
  person('Debnita Kar', 'Delivery Manager - Offshore, EOG, MENA', ROLE.member),
  person('Purushothaman E', 'Delivery Manager - Onsite, A&D, MENA', ROLE.member),
  person('Varun Krishna', 'Delivery Manager - Offshore, A&D, MENA', ROLE.member),
  person('Vishnu Balakrishnan', 'Practice Head, MENA', ROLE.member),
  person('Srinivasan R', 'Practice Lead, Platinum, MENA', ROLE.coOwner),
  person('Subangi', 'Practice Lead, Services, MENA', ROLE.member),
  person('Arul Arokia Raj', 'Practice Lead, EOG, MENA', ROLE.member),
  person('Shravan Balaji', 'Practice Lead, A&D, MENA', ROLE.member),
  person('Rushikesh Subhash Nikam', 'Group Project Manager, Development & Enhancement Projects, Platinum, MENA', ROLE.trackOwner, TRACKS[0]),
  person('Surya M', 'Group Project Manager, SAP Implementation & Rollout Projects, Platinum, MENA', ROLE.trackOwner, TRACKS[1]),
  person('Faizan R', 'Group Project Manager, Managed Services Projects, Platinum, MENA', ROLE.trackOwner, TRACKS[2]),
];

// Four open seats under each track owner, one per vertical.
const OPEN_SEATS = TRACKS.flatMap((track) => VERTICALS.map((vertical) => person('', vertical, ROLE.trackCoOwner, track)));

export const STAKEHOLDERS = Object.freeze([...NAMED, ...OPEN_SEATS].map((entry) => Object.freeze(entry)));

export const roleLabel = (entry) => (entry.track ? `${entry.role} (${entry.track})` : entry.role);
export const withRole = (role) => STAKEHOLDERS.filter((entry) => entry.role === role);
