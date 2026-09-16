# Frontend Rules

Applies now — this is a React + Vite project (JavaScript today; typed rules
below apply automatically once/if the project migrates to TypeScript).

## Components
- **Functional components only.** No class components, ever.
- **One component per file.** The file name matches the component name exactly.
- **Co-locate related files.** Component, its styles, and its tests live in the same directory:
  ```
  src/components/
    ChatInput/
      ChatInput.jsx
      ChatInput.module.css
      ChatInput.test.jsx
      index.js          ← re-exports as the public API
  ```
- **Props** are validated at the top of the file (PropTypes, or a typed `Props`
  shape once TypeScript is adopted).
- **No default export for utilities** — only components use default exports.

## TypeScript (once adopted)
- Strict mode on. No `any`, no `// @ts-ignore` without an explanatory comment.
- Prefer `type` over `interface` for simple shapes. Use `interface` for objects
  that may be extended.
- Enum alternatives: use `as const` objects instead of TypeScript enums.
  ```ts
  const MessageRole = { User: 'user', Assistant: 'assistant' } as const;
  type MessageRole = typeof MessageRole[keyof typeof MessageRole];
  ```

## State Management
- **Local state first** — `useState` and `useReducer` for component-scoped state.
- **Context** only for genuinely global state (auth, theme). Keep contexts small and focused.
- **No global state library** unless the team decides otherwise.
- Derived values are computed from state, not stored in state.

## Hooks
- Custom hooks are prefixed `use` and live in `src/hooks/`.
- A hook that fetches data returns `{ data, isLoading, error }` — consistent across the app.
- Never call hooks conditionally.

## Styling
- CSS Modules (`.module.css`) for component styles. No global CSS except one reset file.
- No inline `style` props except for genuinely dynamic values.
- Class names use camelCase in CSS Modules.
- Colours and spacing come from CSS variables defined centrally. No hardcoded hex values.

## Performance
- `React.memo` only when a component provably re-renders unnecessarily — measure first.
- `useMemo` / `useCallback` only for expensive computations or stable references
  passed to memoised children.
- Lazy-load heavy routes with `React.lazy` + `Suspense`.
- Images use explicit `width` and `height` to prevent layout shift.

## Testing
- Use React Testing Library. Query by role and label, not by CSS class or test ID.
- Every interactive component (forms, buttons, inputs) must have at least one
  integration test.
- Snapshot tests are banned.
