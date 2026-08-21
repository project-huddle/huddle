# Huddle backend instructions

These instructions apply to the `server/` tree.

Read:

* `../.codex/skills/readable-code/SKILL.md`
* `../.codex/skills/typescript-quality/SKILL.md`
* `../.codex/skills/backend-architecture/SKILL.md`
* relevant ADRs under `../docs/ADR/`

## Route files

Do not create giant fluent Elysia chains.

Route modules should remain small enough to review comfortably.

Prefer grouping by cohesive responsibility.

If a route file starts accumulating unrelated concerns such as:

* server lifecycle;
* member administration;
* invites;
* channels;

consider splitting those concerns into separate route modules.

Handlers should generally fit on screen and expose their control flow clearly.

Do not use nested ternaries for HTTP error mapping.

Do not inline complex normalization or authorization decisions.

## Elysia schemas

Use specific schemas whenever the input contract is known.

Do not use `t.Unknown()` and then manually reconstruct a type unless accepting arbitrary input is intentional.

Let framework validation reject structurally invalid requests.

Keep domain validation separate where appropriate.

## Authentication

Avoid repeated non-null assertions such as:

```ts
currentUser!.id
```

If an authenticated route guarantees a user, prefer a typed context where `currentUser` is non-null.

## Error handling

Prefer explicit error branches.

HTTP status, error code and human-readable message should be easy to inspect together.

## Repositories

Do not let route modules become orchestration layers around many repository functions.

If the route is implementing a business workflow, move that workflow into `app`.

## Final review

Before finishing backend work, explicitly inspect newly modified route files for:

* line count;
* handler size;
* nested expressions;
* direct repository orchestration;
* duplicated validation;
* repeated authorization;
* non-null assertions.
