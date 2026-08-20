# ADR-007 — CPF, aferição de idade e privacidade

Status: Aceita com ressalvas — 20/08/2026

## Contexto

O ECA Digital e o Decreto 12.880/2026 exigem proteção e mecanismos proporcionais de aferição de idade, mas não estabelecem obrigação geral de uma rede social coletar CPF. A LGPD exige finalidade, necessidade, transparência e segurança.

## Decisão

Solicitar CPF e nascimento somente quando o usuário declarar perfil brasileiro, com aviso destacado de finalidade exclusiva. Enviar ambos diretamente ao gateway contratado da Serpro e conservar somente a faixa etária, o provedor e o instante da verificação. CPF e nascimento não são persistidos pelo Huddle e devem ser eliminados da memória após a requisição.

## Consequências

O gateway deve ser contratado e configurado com `SERPRO_AGE_VERIFICATION_URL` e `SERPRO_AGE_VERIFICATION_TOKEN`, não registrar corpos e devolver apenas se CPF e nascimento conferem. O art. 13 da Lei 15.211/2025 impede qualquer finalidade secundária. Logs, analytics, reports, perfilamento e suporte não podem receber esses dados.
