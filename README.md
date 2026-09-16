# KaarTech MENA Digital Factory

Web app project, built with React and Vite.

## Getting started

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview a production build locally:

```bash
npm run preview
```

## Project structure

```
src/        React components and app source
public/     Static assets
index.html  App entry point
.claude/    Claude Code project tooling — agents, commands, hooks, rules
tasks/      Working state — backlog, pipeline queue, handoff notes
```

## Working with Claude Code on this repo

See [`CLAUDE.md`](./CLAUDE.md) for the full development process: the staged
pipeline every non-trivial change goes through, the quality gate before
merging to `main`, and all standing conventions. Copy
`CLAUDE.local.md.example` to `CLAUDE.local.md` and
`.claude/settings.local.json.example` to `.claude/settings.local.json` for
personal, gitignored overrides.
