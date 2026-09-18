# Pendências e decisões — REDE27

Estado em 18/09/2026, após o fechamento da **Opção B (R$ 1.256,24)**.

---

## Respondido pelo cliente e implementado

| Ponto | Decisão do Alberto | Situação |
| --- | --- | --- |
| Trava 03 | Segurar o botão 03 por 3s → alerta com localização no Admin | Feito |
| Som do 03 | Silencioso para o motorista, alarme só no Admin | Feito |
| 5 passos | São os do protocolo 03, não os da corrida | Feito |
| Quem recebe a chamada | Painel web do motorista | Feito |
| Entrega | 1 APK + 2 painéis web | Feito |
| Preços | Sem ar 7+2,50 / Com ar 10+3,00 / Bens 12+3,50 | Feito, editável no Admin |
| Taxa | 25% empresa / 75% motorista | Feito, editável no Admin |
| Fotos do motorista | Perfil e veículo obrigatórias, visíveis ao passageiro | Feito |
| Cidades ilimitadas | Sem limite | Feito |
| Cores | Azul `#0A1931` e dourado `#FFC700` | Feito |
| Mapa | Gratuito provisório | Feito (OpenStreetMap + linha reta) |
| Localização | No acionamento, sem segundo plano | Feito |

---

## Ainda esperando o cliente

### 1. Logo

"Logo te mando em seguida." Até chegar, o app usa o selo **REDE 27** feito em
código (`src/components/Logo.tsx`). Trocar por imagem é rápido.

### 2. Domínio de login

O Supabase recusa domínio que não resolve no DNS, então o login por CPF usa
`rede27.app`, que **não é de vocês**. Se o DNS desse domínio mudar, cadastros
novos param. Trocar é uma linha em `CPF.dominioLogin`.

### 3. Verde e branco

Perguntamos se continuam como cor de apoio e não houve resposta. Hoje: branco
como superfície, verde só como cor semântica de sucesso/crédito. É um arquivo.

### 4. Conta de faturamento do Google Maps

Sem ela, a distância continua aproximada (linha reta × fator de rota). Isso
aparece na tela do passageiro como "distância estimada".

---

## Limites conhecidos desta fase

**A distância é aproximada.** Linha reta multiplicada por 1,3 (ajustável no
Admin), com mínimo de 1 km. Em trajetos com rio, viaduto ou contorno longo, a
diferença para a rota real pode ser grande. O app avisa; o cliente aceitou.

**Geocodificação depende do Nominatim.** Serviço gratuito do OpenStreetMap, com
limite de 1 consulta por segundo e sem garantia de disponibilidade. Se ele
falhar, o app segue funcionando: a corrida sai pela distância mínima.

**Repasse ao motorista é calculado, não pago.** Cada corrida concluída grava
quanto é da REDE27 e quanto é do motorista, e o Admin mostra os totais. O
pagamento automático depende de pagamento integrado — fase 2.

**O 03 avisa a central, não a polícia.** Sem gravação de áudio e sem ligação
automática para o 190, conforme combinado. Para operar com passageiros reais,
mantenha o procedimento de emergência que vocês já usam em paralelo.

**Sem rastreamento em segundo plano.** A localização é lida quando o app está
aberto e o passageiro aciona. Rastrear com o app fechado exige permissão
adicional do Android e revisão da Play Store — fase 2.

---

## Contas e papéis

Três papéis, três tabelas, definidos no cadastro:

- **passageiro** → `passageiros` + carteira
- **motorista** → `motoristas` (cria a própria conta em `/motorista`)
- **admin** → `administradores` (cadastro manual por SQL, ninguém se promove)

O SQL para promover um admin está no [README](../README.md#criar-um-administrador).

---

## Armadilha para quem for mexer no banco

Policies de SELECT chamam `eh_admin()` e `eh_motorista()`. A expressão de uma
policy roda com os direitos de **quem consulta**, não do dono da tabela — então
revogar `EXECUTE` dessas funções de `authenticated` derruba a leitura inteira
com `permission denied for function ...`. Já aconteceu uma vez aqui.

E `create or replace function` reconcede `EXECUTE` a `PUBLIC`: depois de
recriar qualquer função, revogue de novo de `public` e `anon`.
