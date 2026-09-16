# Database Rules

> Forward-looking: no database exists in this project yet. Apply these the moment
> one is introduced.

## Models
- Every model inherits from a common `Base`.
- Model files live in one directory. One model class per file for large models.
- Table names are **snake_case plural**: `conversation_messages`, `user_preferences`.
- Column names are **snake_case**.
- Every table has `created_at` and `updated_at` timestamps, set automatically.
- Primary keys use `uuid4` by default — not auto-increment integers.

## Queries
- Always use async sessions if the stack supports async DB access.
- **Never use raw-SQL string interpolation.** Use bound parameters / the ORM query builder.
  ```python
  # Bad — SQL injection risk
  await session.execute(text(f"SELECT * FROM users WHERE email = '{email}'"))
  # Good
  await session.execute(select(User).where(User.email == email))
  ```
- Prefer the ORM over raw SQL. Raw SQL only for complex aggregations.
- Paginate any query that can return a large result set — never fetch unbounded rows.

## Migrations
- **Never edit an existing migration.** Once committed, it is immutable.
- Generate migrations with the framework's autogenerate command.
- Review generated migrations before committing — autogenerate sometimes misses things.
- Destructive changes (column removal, table drop) require a two-phase migration:
  1. Phase 1: deprecate (stop writing to the column, deploy)
  2. Phase 2: remove (second migration, deploy after confirming no reads remain)

## Indexes
- Add an index on any column used in a `WHERE` clause in a hot query.
- Add an index on foreign keys — most ORMs do NOT do this automatically.
- Composite indexes: highest-cardinality column first.
- Name indexes explicitly: `ix_<table>_<column>`.

## Naming Conventions
| Object | Convention | Example |
|---|---|---|
| Table | snake_case plural | `conversation_messages` |
| Column | snake_case | `created_at` |
| Index | `ix_<table>_<col>` | `ix_messages_session_id` |
| Foreign key | `fk_<table>_<ref_table>` | `fk_messages_sessions` |
| Primary key | `pk_<table>` | `pk_messages` |

## Transactions
- Keep transactions short. Never hold one open across a network call.
- Use an explicit atomic-block context manager for operations that must be atomic.
- On failure, let exceptions propagate — the ORM rolls back automatically on context exit.
