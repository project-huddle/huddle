# Realtime vertical slices design

## Intent

Organize the frontend realtime feature by responsibility and complete the ICE migration so every new or restarted peer connection uses credentials fetched from the authenticated server endpoint. The `rtcConfig` local constant must not return.

## Goals

- Keep `useRealtime` as the compatibility facade for existing UI consumers.
- Group socket, call media, peer connection, and observable state code inside `client/src/features/realtime/`.
- Keep browser resources and imperative lifecycles in hooks/services; use a keyed Zustand store only for observable call state shared by UI consumers.
- Fetch current ICE credentials from `/calls/ice-config` before creating each peer connection and refresh them before ICE restart offers.
- Preserve WebSocket protocol, existing API payloads, and current UI behavior.

## Non-goals

- Change server ICE credential generation, TURN configuration, or WebSocket event protocol.
- Move `WebSocket`, `RTCPeerConnection`, timers, or `MediaStream` ownership into Zustand.
- Migrate unrelated chat or social state.

## Approaches

1. **Vertical slices with a state store (chosen):** Move realtime hooks and helpers into a feature folder, keep the existing public hook as a thin re-export/facade, and use a channel-keyed Zustand store for UI-visible call state. Socket lifecycle and WebRTC resources remain in feature hooks. This improves cohesion while preserving imperative ownership.
2. **One global realtime store:** Put socket, peer connections, timers, and call state into a single Zustand store. This centralizes access but mixes browser resource lifecycle with render state and increases cleanup and test coupling.
3. **File-only split with local reducer:** Split the large hook into feature files but leave call state local. This is the smallest migration, but it does not provide the shared observable state boundary already used elsewhere in the client.

## Design

The feature is organized around `client/src/features/realtime/` with separate state, socket, call-session, and media/peer responsibilities. `client/src/hooks/use-realtime.ts` remains a compatibility entrypoint for current imports. Call state is keyed by scope, channel type, and channel/call ID, so the text and voice realtime instances for one channel do not overwrite one another. Store actions update UI state plus the existing stream references required by media views; socket objects, peer connections, pending ICE candidates, recovery timers, and call lifecycle refs stay in their owning hook/session coordinator.

Peer creation becomes asynchronous. The feature fetches ICE configuration with `fetchRTCConfiguration(token)` before constructing `RTCPeerConnection`. A single in-flight creation per peer is reused to avoid races when `peer_joined` and `webrtc_offer` arrive together. During ICE recovery, the feature fetches fresh configuration, applies it with `setConfiguration`, then restarts ICE and sends the resulting offer. Failure to fetch configuration is surfaced through the existing realtime error path; there is no local fallback.

## Constraints and acceptance

- No local STUN/TURN configuration or `rtcConfig` export remains.
- ICE fetch requests remain authenticated and use `cache: "no-store"`.
- Existing `useRealtime` consumers need no import changes.
- Realtime event contracts, API endpoints, and server behavior remain unchanged.
- Existing tests are updated only where their expected feature paths or contracts require it; verification commands are reported explicitly.

## Open choices resolved by the implementer

- Use Zustand selectors for keyed call state and explicit reset on feature cleanup.
- Keep chat messages and socket connection status scoped to each hook instance unless current consumers require sharing.
- Preserve existing naming conventions while moving related files into the feature slice.
