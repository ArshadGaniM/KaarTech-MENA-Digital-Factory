// Staged development pipeline (CLAUDE.md §7). Invoke via the Workflow tool —
// never via the Agent/Task tool as an "orchestrator" subagent (see §7.1 and
// .claude/agents/orchestrator.md for why that's structurally unsafe in a
// sandbox without nested subagent spawning).
//
// Each entry in STAGES corresponds to one row of the pipeline table in
// CLAUDE.md §7.4, and to one file in .claude/agents/dev-team/<slug>.md.
// Code accumulates forward: the `code` object returned by 'engineer-mvp'
// onward is passed to, and returned (possibly modified) by, every later
// code-touching stage — never regenerated from scratch (invariant 1, §7.6).
//
// This script processes exactly one feature per invocation (`args.feature`),
// so stages already run in strict sequence with no cross-feature role
// contention — no mutex is needed here. Extend with a per-role lock only if
// this script is changed to process multiple features in one invocation.

export const meta = {
  name: 'dev-team',
  description: 'Staged development pipeline — one feature per run, all 30 roles in strict sequence',
  phases: [
    { title: 'Design', detail: 'Explorer through Architecture Critic' },
    { title: 'Build', detail: 'System design through Code Simplifier' },
    { title: 'Test', detail: 'Test Architect through Bug-Fixer loop' },
    { title: 'Harden', detail: 'Debugger through final Architect sign-off' },
  ],
}

const STAGES = [
  { slug: 'codebase-explorer', phase: 'Design' },
  { slug: 'business-analyst', phase: 'Design' },
  { slug: 'enterprise-architect-pre', phase: 'Design' },
  { slug: 'tech-lead', phase: 'Design' },
  { slug: 'solution-architect', phase: 'Design' },
  { slug: 'architecture-critic', phase: 'Design', blocking: true },
  { slug: 'system-engineer', phase: 'Build' },
  { slug: 'engineer-mvp', phase: 'Build', producesCode: true },
  { slug: 'developer', phase: 'Build' },
  { slug: 'database-specialist', phase: 'Build' },
  { slug: 'language-framework-specialist', phase: 'Build' },
  { slug: 'code-reviewer-stage', phase: 'Build' },
  { slug: 'frontend-engineer', phase: 'Build' },
  { slug: 'type-design-analyzer', phase: 'Build' },
  { slug: 'senior-engineer', phase: 'Build' },
  { slug: 'software-architect', phase: 'Build' },
  { slug: 'silent-failure-hunter-stage', phase: 'Build' },
  { slug: 'code-simplifier', phase: 'Build' },
  { slug: 'process-organiser', phase: 'Build' },
  { slug: 'test-architect', phase: 'Test' },
  { slug: 'test-script-writer', phase: 'Test' },
  { slug: 'test-quality-analyzer', phase: 'Test' },
  { slug: 'tester', phase: 'Test' },
  { slug: 'bug-fixer', phase: 'Test', loopWith: 'tester', maxIterations: 5 },
  { slug: 'debugger-stage', phase: 'Harden', terminal: true },
  { slug: 'performance-engineer', phase: 'Harden', terminal: true },
  { slug: 'security-auditor-stage', phase: 'Harden', terminal: true },
  { slug: 'devops-engineer', phase: 'Harden', terminal: true },
  { slug: 'production-validator', phase: 'Harden', terminal: true },
  { slug: 'enterprise-architect-post', phase: 'Harden', terminal: true, alwaysRuns: true },
]

// A forbidden-path/pattern denylist checked after every code-generating step
// (invariant 3, §7.6). Extend as real denylist patterns are identified for
// this project — currently a placeholder illustrating the mechanism.
const FORBIDDEN_PATTERNS = [
  /process\.env\.[A-Z_]*SECRET[A-Z_]*\s*=\s*['"][^'"]+['"]/, // hardcoded secret assignment
]

function checkDenylist(code) {
  const text = typeof code === 'string' ? code : JSON.stringify(code)
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, pattern: String(pattern) }
    }
  }
  return { blocked: false }
}

// Every stage returns StructuredOutput matching this shape — `code` (the
// full accumulated code object, as JSON) and `verdict` are optional since
// most stages don't touch code or issue a blocking verdict, but `summary`
// is always required so a halt/report always has something human-readable
// to show.
const STAGE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    verdict: { type: 'string' },
    code: { type: 'object' },
  },
  required: ['summary'],
}

const feature = args.feature
let currentCode = args.code || null
const stageResults = []

for (const stage of STAGES) {
  phase(stage.phase)

  const result = await agent(
    `Run the ${stage.slug} stage of the dev-team pipeline for ${feature.id}: ${feature.description}. ` +
      `Read .claude/agents/dev-team/${stage.slug}.md for your role instructions. ` +
      (currentCode
        ? `Current code object to improve in-place (JSON):\n${JSON.stringify(currentCode)}`
        : 'No code exists yet.') +
      ' Return your summary; if your role produces or modifies code, include the full updated code object under `code`; ' +
      'if your role issues a pass/block verdict (e.g. architecture-critic), include it under `verdict` as either "OK" or "BLOCKED".',
    { label: `${feature.id}:${stage.slug}`, phase: stage.phase, schema: STAGE_SCHEMA }
  )

  if (stage.producesCode || currentCode) {
    currentCode = result.code ?? currentCode
  }

  if (currentCode) {
    const denylistCheck = checkDenylist(currentCode)
    if (denylistCheck.blocked) {
      return {
        featureId: feature.id,
        status: 'halted',
        reason: `Forbidden pattern denylist hit after stage ${stage.slug}: ${denylistCheck.pattern}`,
      }
    }
  }

  if (stage.blocking && result.verdict === 'BLOCKED') {
    return {
      featureId: feature.id,
      status: 'halted',
      reason: `${stage.slug} blocking finding: ${result.summary}`,
    }
  }

  stageResults.push({ stage: stage.slug, result })
}

return {
  featureId: feature.id,
  status: 'completed',
  code: currentCode,
  stageResults,
}
