# ADR-007 — Rejeição da aferição de idade por CPF

Status: Rejeitada — 22/08/2026

## Contexto

Foi avaliado o uso de CPF e data de nascimento para identificar usuários brasileiros e aferir sua idade por meio de uma API da Serpro. A legislação aplicável exige proteção e mecanismos proporcionais de aferição de idade, mas não estabelece obrigação geral de uma rede social coletar CPF.

Após a investigação, o custo por requisição da integração mostrou-se alto para o modelo do Huddle. A coleta também acrescentaria tratamento de dados pessoais, dependência de um fornecedor externo e complexidade operacional sem benefício proporcional.

## Decisão

Não usar CPF para identificação ou aferição de idade e não integrar o Huddle à API avaliada para essa finalidade. O produto não deve solicitar CPF nem data de nascimento como parte desse fluxo.

A proposta anterior de consultar CPF e nascimento em um serviço externo está rejeitada e não orienta a implementação.

## Consequências

- A integração e seus custos por requisição deixam de fazer parte da arquitetura planejada.
- Configurações, credenciais, adaptadores e interfaces específicos desse fluxo não devem ser mantidos.
- O Huddle evita coletar CPF e data de nascimento para essa finalidade.
- Uma futura solução de aferição de idade dependerá de nova investigação e de uma nova ADR que considere proporcionalidade, privacidade, custo e requisitos legais, sem reativar implicitamente esta proposta.
