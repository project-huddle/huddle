# Server Vertical Slices Migration Plan

## Goal

Organize backend behavior by product capability under `server/src/features`, removing the horizontal `app` and HTTP `routes` source folders while preserving existing HTTP, WebSocket, and persistence behavior.

## Design

Business behavior belongs to feature folders. HTTP and realtime adapters live with the feature they expose. Persistence repositories and email integration live with their owning feature. Shared HTTP plugins, response helpers, schema primitives, bootstrap configuration, domain models, and the Prisma client/mappers remain shared because they serve multiple features or have framework/infrastructure scope. Realtime transport moves under a dedicated realtime feature. There will be no compatibility facades at old paths.

The migration is structural. It does not change endpoints, payloads, status codes, authorization, database schema, or WebSocket protocol. Existing repositories remain explicit and imports point directly to the owning feature. Existing cross-feature behavior is preserved.

## Approaches

1. **Move capabilities into feature folders (chosen):** relocate application services, route adapters, and realtime transport under `features/<capability>`. Keep truly shared domain, infrastructure, and transport primitives in their existing shared areas. This follows ADR-009 and keeps behavior changes out of a broad architecture move.
2. **Rewrite all handlers around ports and injected use cases at once:** this would improve isolation more deeply, but it combines behavior-sensitive rewrites with file moves and makes this migration harder to review safely.
3. **Keep the layer folders and only add feature facades:** rejected because it preserves the horizontal architecture and introduces indirection without moving ownership.

## Tasks

1. Move application services and tests into owning feature folders, split mixed email/message validation, and remove `server/src/app`.
2. Move HTTP route adapters into their owning feature folders, retain shared HTTP plugins/schemas/responses, and update application composition.
3. Move realtime gateways into the realtime feature and update imports in bootstrap, routes, and tests.
4. Move persistence and email adapters into their owning features; keep shared database client/mappers in `server/src/shared/infrastructure`.
5. Search for stale horizontal paths and review the resulting feature tree and dependency direction.

## Repository separation follow-up

Prisma queries live in feature-local repositories under `features/<capability>/infrastructure`. Shared Prisma client and mapper utilities stay in `shared/infrastructure/database`. HTTP and application modules do not import Prisma or query the client directly. The large server repository is split by server lifecycle, members, roles, channels, invites, and realtime presence. Existing repository behavior is preserved while queries are extracted from transport and application code.

## Constraints

- Preserve runtime behavior and public contracts.
- Do not add old-path facades.
- Do not move domain entities into feature folders solely for structural symmetry.
- No generated application container or generic mediator.
- Tests and typecheck are not run in this task unless separately requested.
