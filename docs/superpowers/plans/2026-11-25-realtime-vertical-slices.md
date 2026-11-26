# Realtime Vertical Slices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Organize realtime code into a cohesive frontend feature slice and use server-fetched ICE credentials for all peer creation and ICE restarts.

**Architecture:** Organize client code into feature slices under `client/src/features/` and shared primitives under `client/src/shared/`. Use a session-keyed Zustand store for observable call state, while hooks/services own socket, peer connections, timers, media streams, and lifecycle refs. Fetch ICE configuration asynchronously before peer construction and before ICE restart offers.

**Tech Stack:** React 19, TypeScript, Zustand 5, WebRTC, existing Bun unit tests.

**Spec:** `docs/superpowers/specs/2026-11-25-realtime-vertical-slices-design.md`

## Global Constraints

- Do not restore a client-local `rtcConfig` or static STUN/TURN fallback.
- Preserve existing WebSocket events, API paths, and UI-facing `useRealtime` return shape.
- ICE credentials come from authenticated `/calls/ice-config` requests with `cache: "no-store"`.
- `WebSocket`, `RTCPeerConnection`, timers, and imperative lifecycle refs remain outside Zustand.
- Preserve all pre-existing unrelated workspace changes.

## Review Focus

- Two session keys must not leak call state into each other — preserve all keyed store reads and resets.
- Simultaneous peer events must not create duplicate `RTCPeerConnection`s — reuse in-flight peer creation.
- ICE recovery must use refreshed server credentials — refresh before `setConfiguration` and restart offer.
- ICE endpoint failures must leave no half-created peer — do not insert a peer until configuration and construction succeed.
- Session cleanup during an in-flight ICE fetch must close/discard the late peer — recheck lifecycle after the await.

---

### Task 1: Establish the realtime feature slice and keyed call store

**Files:**
- Create: `client/src/features/realtime/state/call-store.ts`
- Move: `client/src/hooks/use-call-state.ts` responsibilities into the feature store
- Modify: `client/src/features/realtime/hooks/use-realtime-session.ts`
- Test: `client/test/unit/realtime-config.test.ts` only if its source import moves

**Interfaces:**
- Produces `useCallStore(sessionKey)` selectors/actions for call-visible state.
- Session key is derived consistently from `scope`, `channelType`, and `channelId`.
- Store actions include reset for one session and updates for each existing call-state field.

- [ ] Map all current state reads/writes and consumer expectations before moving state.
- [ ] Add keyed store and adapt the hook to select its session state.
- [ ] Ensure cleanup resets only the matching session key.
- [ ] Keep transient socket/peer/timer refs in the hook.
- [ ] Review imports and type relationships after the move.

### Task 2: Move realtime code into the vertical feature boundary

**Files:**
- Create: `client/src/features/realtime/hooks/use-realtime-session.ts`
- Move: `client/src/hooks/use-realtime-connection.ts`
- Move: `client/src/hooks/use-call-devices.ts`
- Move: `client/src/hooks/use-screen-sharing.ts`
- Create: `client/src/features/realtime/hooks/use-peer-connections.ts`
- Move: `client/src/hooks/use-call-state.ts` or remove after Task 1
- Modify: every current `useRealtime` consumer to import the session hook directly

**Interfaces:**
- All consumers import `useRealtime` from `@/features/realtime/hooks/use-realtime-session`.
- Feature-internal modules import each other through `@/features/realtime/...`.
- Feature session hook retains the existing `useRealtime` arguments and return contract.

- [ ] Move each responsibility with its dependencies and update relative imports.
- [ ] Remove all generic-layer hook/store/schema/type/view directories after relocating their modules.
- [ ] Group peer/media utilities under the same feature only when they are realtime-specific.
- [ ] Search all old paths and confirm no stale internal imports remain.

### Task 3: Use fetched ICE configuration for peer creation and recovery

**Files:**
- Modify: `client/src/features/realtime/hooks/use-realtime-session.ts`
- Modify: `client/src/features/realtime/hooks/use-realtime-connection.ts`
- Modify: `client/src/features/realtime/lib/realtime.ts`
- Modify: `client/test/unit/realtime-config.test.ts` only for helper relocation or contract adjustment

**Interfaces:**
- `fetchRTCConfiguration(token: string): Promise<RTCConfiguration>` remains the single ICE configuration API.
- Peer factory becomes `createPeer(userId: string): Promise<RTCPeerConnection>`.
- Connection options consume an async peer factory.

- [ ] Make peer creation await server ICE configuration and add an in-flight promise map per peer.
- [ ] Await peer creation in `peer_joined` and `webrtc_offer` handling.
- [ ] Recheck active call lifecycle after fetching ICE configuration; close and discard late peers.
- [ ] Before ICE recovery, fetch configuration again, call `setConfiguration`, then restart ICE and send the offer.
- [ ] Remove all `rtcConfig` imports and references and verify no local ICE configuration remains.
- [ ] Route ICE fetch failures through the existing visible realtime error state.

### Task 4: Finalize the feature boundary and inspect behavior-preserving changes

**Files:**
- Modify: affected feature modules and feature entrypoints
- Review: all `client/src/features/**`, `client/src/shared/**`, and updated imports

- [ ] Confirm all `useRealtime` call sites import the session hook directly.
- [ ] Confirm the add-server dialog exposes create and join actions and accepts invite codes/links.
- [ ] Confirm state is isolated by session key and cleanup does not reset other sessions.
- [ ] Confirm every peer creation/restart uses fetched server configuration and there is no local fallback.
- [ ] Review the final diff for unrelated edits and report verification status accurately.
