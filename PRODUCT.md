# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Desenvolvedores e avaliadores testando o Offline Protocol SDK. Abrem o app num aparelho de teste (dev client) para provar que a mensageria funciona sem internet e, com a bridge, também via Matrix. O público final ainda não está definido.

## Product Purpose

PoC de mensageria offline-first: troca de mensagens e chamadas entre aparelhos próximos por mesh (BLE, Wi-Fi Direct), com uma bridge Python que expõe o SDK ao browser e provisiona contas Matrix. Sucesso é um avaliador completar o onboarding e trocar uma mensagem em poucos minutos.

## Positioning

Comunicação que não depende de servidor central nem de operadora: o mesh funciona sem internet, e o Matrix entra só como ponte quando há rede.

## Operating Context

- Aparelhos iOS e Android de teste, com dev client; Expo Go e web rodam com adaptadores demo.
- A bridge roda no PC do desenvolvedor, na mesma LAN do celular.
- Homeserver Matrix local (Conduit/continuwuity/Synapse em Docker) para testes.

## Capabilities and Constraints

- Onboarding: telefone (identidade), username Matrix escolhido pelo usuário, permissões (Bluetooth/nearby, notificações, microfone, contatos).
- UI nativa por plataforma com `@expo/ui` (SwiftUI no iOS, Jetpack Compose no Android).
- Camadas DDD e quality gate descritos em `docs/CONVENTIONS.md`.
- Sem OTP real: o telefone não é verificado nesta PoC.

## Brand Commitments

- Sem nome nem logo ainda: textos neutros, sem marca inventada.
- Tema white-label: cores e raios vêm de tokens substituíveis. Paleta base do artefato "Design System" (ameixa `#60495a`, `#3f3244`, `#2f2235`; cinzas `#bfc3ba`, `#a9aca9`).
- Voz em pt-BR, direta e calma: frases curtas, sem jargão (nada de "mesh", "peer" ou "Matrix" para o usuário), e cada permissão explica por que é pedida.

## Evidence on Hand

Nenhum depoimento, métrica ou cliente. Não inventar.

## Product Principles

- Funciona primeiro offline; a rede é bônus.
- Pedir só o necessário e dizer por quê.
- Nunca bloquear o usuário por uma permissão negada.
- Trocável: a identidade visual é um tema, não código.

## Accessibility & Inclusion

Contraste 4.5:1 para texto, Dynamic Type no iOS e escala de fonte no Android, rótulos de acessibilidade em todos os controles.
