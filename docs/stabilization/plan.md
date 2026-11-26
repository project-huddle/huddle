# Pre-homologation stabilization implementation plan

Base: 294b70f on fix/chat-media-friends-and-account-ui. Working branch: fix/pre-homologation-stabilization.
Spec: user pre-homologation stabilization and security review request, phases 1–4.

Constraints: no merge/deploy; no production secrets or real database mutations; English source/comments and existing Portuguese UI; preserve contracts except justified security/pagination changes; test confirmed defects; no major upgrades.

- [ ] Baseline: backend tests, both type checks, frontend lint/build, current E2E; disposable PostgreSQL only.
- [ ] Session lifecycle: bind tickets/sockets to token hashes and expiry, central revocation observers, immediate logout/password revocation, reconnection and multi-session regression tests.
- [ ] Profile privacy: explicit public identity projection at all social/realtime boundaries; private self profile unchanged; absence tests.
- [ ] Media authorization: persisted upload ownership; authenticated access for owner, message participants/channel members, public avatars/icons; legacy private references protected; no-store and signature validation; authenticated frontend blobs; access regression tests.
- [ ] Mentions: one literal parser algorithm for server/frontend, punctuation/boundary tests.
- [ ] Devices: transactional capture/replacement/preferences with rollback and cleanup; fake media tests.
- [ ] Private calls: explicit hangup versus grace reconnect, deterministic cleanup/takeover/signaling tests.
- [ ] Private history: stable timestamp+id cursors, earlier-page UI scroll anchoring, conversation request race guards; backend/E2E tests.
- [ ] CI/hygiene: disposable PostgreSQL + migrations + critical Playwright; ignore/untrack generated artifacts; audit lockfiles and dependency advisories; ephemeral TURN configuration.
- [ ] Migration replay: populated legacy fixtures, historical preservation and constraints; no deployed migration edits.
- [ ] Final review: full diff, executed tests, hml conflict analysis without merge, secret scan, structured report A–H and grouped commits.

Architecture: small specific modules for session revocation, public DTO projection, media authorization/signing, mention parsing, cursor encoding, device transactions and direct-call connections. Keep Elysia as adapter and avoid wholesale realtime/store rewrites.

Review focus: revocation races during socket establishment; media legacy references and mixed-use files; malformed and foreign cursors; concurrent device switches and call teardown; tab takeover and reconnect after hangup.
