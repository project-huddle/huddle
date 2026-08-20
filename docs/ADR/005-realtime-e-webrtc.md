# ADR-005 — WebSocket para eventos e WebRTC para mídia

Status: Aceita — 20/08/2026

## Decisão

Usar WebSocket autenticado por ticket descartável para chat, presença e sinalização; áudio, câmera e tela trafegam diretamente por WebRTC. A autorização é vinculada ao canal e revogada quando a associação termina.

## Consequências

A API não transporta mídia, mas conexões em redes restritivas exigem TURN. A solução P2P não escala bem para chamadas grandes; uma SFU deve ser avaliada antes desse requisito.
