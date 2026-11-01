import InitiativePlan from '../InitiativePlan';
import { NAV_ITEMS } from '../../lib/navigation';
import { PLAN_GROUPS, PLAN_OWNER, PLAN_WEEK_COUNT } from '../../data/initiativePlan';
import { weekEnd, weekStart } from '../../lib/initiativePlanCalendar';
import styles from './Charter.module.css';

// Everything below is derived from three sources: the locked initiative plan
// (src/data/initiativePlan.js), the portal's own pages, and the rules the
// application already enforces. Nothing here is a new fact. Where the charter
// needs something the owner has not supplied, it says "To be confirmed".

const TBC = 'To be confirmed';
const DAY = { day: 'numeric', month: 'short', year: 'numeric' };
const dateText = (date) => date.toLocaleDateString('en-GB', { timeZone: 'UTC', ...DAY });
const weekSpan = (group) => `Weeks ${group.startWeek} to ${group.endWeek}`;
const stream = (group) => group.activity.replace('Onshore Enabled Factory Delivery - ', '');

// The nine steps repeat in every stream, so the first stream names them.
const STEP_TEXT = Object.fromEntries(PLAN_GROUPS[0].items.map((item) => [item.slNo, item.activity]));
const stepOf = (group, slNo) => group.items.find((item) => item.slNo === slNo);

function Table({ caption, head, rows }) {
  return (
    <table className={styles.table}>
      <caption className={styles.caption}>{caption}</caption>
      <thead>
        <tr>
          {head.map((cell) => (
            <th key={cell} scope="col">{cell}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.join('|')}>
            {row.map((cell, index) => (
              <td key={`${index}-${cell}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Overview() {
  const last = weekEnd(PLAN_WEEK_COUNT);
  return (
    <>
      <p>
        The KaarTech MENA Digital Factory is KaarTech&apos;s shared delivery operation for the region. It runs
        development, quality assurance, design, assessments, audits, managed support and AI transformation
        consulting as one connected delivery operation, not a series of one-off projects.
      </p>
      <p>
        This initiative sets that operation up as an onshore enabled factory delivery model. Work is delivered
        from four delivery centers: Khobar and Riyadh in Saudi Arabia (onshore), and Chennai and Bangalore in
        India (offshore).
      </p>
      <Table
        caption="Initiative at a glance"
        head={['Item', 'Detail']}
        rows={[
          ['Plan owner', PLAN_OWNER.label],
          ['Start', dateText(weekStart(1))],
          ['Finish', `${dateText(last)} (Week ${PLAN_WEEK_COUNT})`],
          ['Streams', String(PLAN_GROUPS.length)],
        ]}
      />
    </>
  );
}

function Objectives() {
  return (
    <>
      <p>The initiative sets out to do these things, in each of its streams:</p>
      <ol className={styles.list}>
        <li>Staff the offshore delivery center from the existing account pools.</li>
        <li>Split the projects into workstreams.</li>
        <li>Split people into small teams per workstream, with a lead appointed for each team.</li>
        <li>Set up zero trust network connectivity, and test VPN rerouting from KSA to India.</li>
        <li>Adopt the existing projects and run them under the revised structure.</li>
        <li>Put a KPI-driven governance framework in place for measuring utilization.</li>
        <li>Establish an SOP document.</li>
        <li>Pilot two projects from other BUs or verticals, to test whether the model holds.</li>
        <li>Submit a rollout strategy document for all MENA projects.</li>
      </ol>
    </>
  );
}

function Scope() {
  return (
    <>
      <p>The initiative covers three streams of onshore enabled factory delivery.</p>
      <Table
        caption="Streams in scope"
        head={['Sl. No', 'Stream', 'Planned weeks', 'Planned dates', 'Status']}
        rows={PLAN_GROUPS.map((group) => [
          group.slNo,
          stream(group),
          weekSpan(group),
          `${dateText(weekStart(group.startWeek))} to ${dateText(weekEnd(group.endWeek))}`,
          group.status,
        ])}
      />
      <p>
        The work is delivered from the four delivery centers named in the overview, and covers the seven
        services shown on this portal.
      </p>
    </>
  );
}

function InitiativePlanPanel() {
  return <InitiativePlan readOnly />;
}

function ExecutionApproach() {
  const offsets = PLAN_GROUPS.slice(1).map((group, index) => group.startWeek - PLAN_GROUPS[index].startWeek);
  const evenly = offsets.every((offset) => offset === offsets[0]);
  return (
    <>
      <p>
        Each stream follows the same four phases, in the same order. The phases come from the nine steps of the
        initiative plan.
      </p>
      <Table
        caption="Phases of each stream"
        head={['Phase', 'What happens', 'Plan steps']}
        rows={[
          ['1. Set up', `${STEP_TEXT.a}. ${STEP_TEXT.b}. ${STEP_TEXT.c}. ${STEP_TEXT.d}.`, 'a to d'],
          ['2. Run', `${STEP_TEXT.e}.`, 'e'],
          ['3. Govern', `${STEP_TEXT.f.replace('Measruing', 'Measuring')}. ${STEP_TEXT.g}.`, 'f and g'],
          ['4. Prove and scale', `${STEP_TEXT.h}. ${STEP_TEXT.i}.`, 'h and i'],
        ]}
      />
      <p>
        {evenly
          ? `The streams start one after another, ${offsets[0]} weeks apart: `
          : 'The streams start one after another: '}
        {PLAN_GROUPS.map((group) => `${stream(group)} in Week ${group.startWeek}`).join(', ')}.
      </p>
      <p>
        Progress is shown against the plan: each activity has a planned bar and a percentage complete, and an
        activity is flagged as behind plan when its planned end has passed without it being complete.
      </p>
    </>
  );
}

function Stakeholders() {
  return (
    <>
      <p>
        These are the parties the plan itself names or depends on. Names are for the owner to fill in.
      </p>
      <Table
        caption="Stakeholder matrix"
        head={['Stakeholder', 'Role in the initiative', 'Plan steps', 'Named person']}
        rows={[
          [PLAN_OWNER.label, 'Owns the initiative plan', 'All', TBC],
          ['Account teams', 'Provide the existing account pools that staff the delivery center', 'a', TBC],
          ['Workstream team leads', 'Lead one small team each, appointed per workstream', 'c', TBC],
          ['Network and security owners', 'Set up zero trust connectivity and test VPN rerouting from KSA to India', 'd', TBC],
          ['Delivery center teams', 'Khobar, Riyadh, Chennai and Bangalore run the projects under the revised structure', 'e', TBC],
          ['Other BUs or verticals', 'Provide two pilot projects to test the model', 'h', TBC],
          ['KaarTech customers', 'Receive delivery from the factory on their projects', 'e', TBC],
        ]}
      />
    </>
  );
}

function Governance() {
  return (
    <>
      <p>Three things keep the initiative under control.</p>
      <ul className={styles.list}>
        <li>
          A KPI-driven governance framework for measuring utilization, built in each stream
          ({PLAN_GROUPS.map((group) => `${group.slNo.charAt(0)}f: Weeks ${stepOf(group, 'f').startWeek} to ${stepOf(group, 'f').endWeek}`).join(', ')}).
        </li>
        <li>
          An SOP document for each stream, so the way of working is written down
          ({PLAN_GROUPS.map((group) => `${group.slNo.charAt(0)}g: Weeks ${stepOf(group, 'g').startWeek} to ${stepOf(group, 'g').endWeek}`).join(', ')}).
        </li>
        <li>
          Allocation rules in the application: a person can be allocated to several positions with different
          percentages, and the total must not go above 100 percent.
        </li>
      </ul>
      <Table
        caption="Governance details still open"
        head={['Item', 'Detail']}
        rows={[
          ['KPI targets', TBC],
          ['Reporting cadence', TBC],
          ['Decision forum', TBC],
        ]}
      />
    </>
  );
}

function Deliverables() {
  const rows = PLAN_GROUPS.flatMap((group) => [
    ['f', 'KPI governance framework for utilization'],
    ['g', 'SOP document'],
    ['h', 'Two pilot projects completed'],
    ['i', 'Rollout strategy document for all MENA projects'],
  ].map(([slNo, name]) => {
    const step = stepOf(group, slNo);
    return [stream(group), name, `Week ${step.endWeek}`, dateText(weekEnd(step.endWeek))];
  }));
  return (
    <>
      <p>Due dates are the end of the planned week for each step, counted from {dateText(weekStart(1))}.</p>
      <Table caption="Deliverables and milestones" head={['Stream', 'Deliverable', 'Due week', 'Due date']} rows={rows} />
    </>
  );
}

function Resources() {
  const tools = ['Resources', 'Teams', 'Positions', 'Resource Deployment', 'Departments'];
  return (
    <>
      <p>
        People, teams and positions are managed in the application, not in the portal. The charter points to
        them.
      </p>
      <ul className={styles.list}>
        {tools.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
      <p>
        <a href={NAV_ITEMS[0].hash} className={styles.link}>Open the application</a>
      </p>
    </>
  );
}

function Risks() {
  return (
    <>
      <p>The plan assumes these things hold:</p>
      <ul className={styles.list}>
        <li>The existing account pools can supply enough people for the delivery center.</li>
        <li>Zero trust connectivity and VPN rerouting from KSA to India can be set up and tested.</li>
        <li>Other BUs or verticals will release two projects for the pilot.</li>
      </ul>
      <p>The plan also fixes this order inside each stream:</p>
      <ul className={styles.list}>
        <li>Governance and the SOP come after the existing projects are adopted and running.</li>
        <li>The pilot and the rollout strategy come after governance is in place.</li>
      </ul>
      <Table caption="Risks" head={['Item', 'Detail']} rows={[['Risks and mitigations', 'None recorded yet. To be confirmed by the owner.']]} />
    </>
  );
}

export const SECTIONS = [
  { id: 'overview', title: 'Overview', Panel: Overview },
  { id: 'objectives', title: 'Objectives', Panel: Objectives },
  { id: 'scope', title: 'Scope', Panel: Scope },
  { id: 'initiative-plan', title: 'Initiative Plan', Panel: InitiativePlanPanel },
  { id: 'execution-approach', title: 'Execution Approach', Panel: ExecutionApproach },
  { id: 'stakeholders', title: 'Stakeholder Matrix', Panel: Stakeholders },
  { id: 'governance', title: 'Governance and KPIs', Panel: Governance },
  { id: 'deliverables', title: 'Deliverables and Milestones', Panel: Deliverables },
  { id: 'resources', title: 'Resources and Team Setup', Panel: Resources },
  { id: 'risks', title: 'Assumptions, Dependencies and Risks', Panel: Risks },
];

