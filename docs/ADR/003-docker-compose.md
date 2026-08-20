# ADR-003 — Docker e Docker Compose

Status: Aceita — 20/08/2026

## Contexto

API, cliente e PostgreSQL exigem versões e configuração reproduzíveis entre desenvolvimento, CI e entrega.

## Decisão

Empacotar cliente e servidor em imagens próprias e orquestrar o ambiente de referência com Compose. `compose.dev.yaml` é um override e deve ser usado junto de `compose.yaml`.

## Consequências

O ambiente ganha paridade e migrações automáticas. Segredos não pertencem às imagens nem ao repositório; produção deve usar um gerenciador de segredos e persistência externa adequada.
