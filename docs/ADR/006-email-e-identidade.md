# ADR-006 — E-mail transacional com Nodemailer

Status: Aceita — 20/08/2026

## Decisão

Usar Nodemailer por SMTP para confirmação de e-mail, códigos de segundo fator e aviso de reports. Códigos são aleatórios, persistidos apenas como hash, expiram em dez minutos e são consumidos no uso.

## Consequências

Produção requer SMTP confiável, SPF, DKIM, DMARC e observabilidade de entrega. Sem SMTP, desenvolvimento usa transporte JSON sem imprimir códigos. E-mail como segundo fator melhora a segurança, mas TOTP/WebAuthn é a evolução recomendada.
