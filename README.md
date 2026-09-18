# REDE27 — MVP

Aplicativo de transporte de passageiros, bens e encomendas.
Codigo unico para **Android (APK)** e **web**, com backend no **Supabase**.

## Stack

| Camada | Escolha | Por que |
| --- | --- | --- |
| App | Expo SDK 57 + React Native + expo-router | Um codigo gera o APK e a versao web |
| Backend | Supabase (Postgres + Auth + Realtime) | Banco relacional deixa a carteira consistente |
| Build APK | EAS Build (nuvem) | Nao exige Android SDK/JDK na maquina |

## Telas

| # | Rota | Conteudo |
| --- | --- | --- |
| 1 | `/login` | Acesso e cadastro por CPF (com validacao de digito verificador) |
| 2 | `/inicio` | "Para onde vamos?" com voz, categorias com preco, carteira, botao CHAMAR com trava 03 |
| 3 | `/corrida` | Protocolo de 5 passos, atualizado em tempo real |
| — | `/carteira` | Extrato (apoio da tela 2, nao conta como tela principal) |
| — | `/motorista` | Painel que recebe as chamadas nesta fase (simulacao, nao entra nas 3 telas) |

## Como rodar

```bash
npm install
cp .env.example .env          # preencher com URL e chave anon do Supabase
npm run web                   # versao web em desenvolvimento
npm run android               # app no aparelho/emulador
npm run typecheck             # checagem de tipos
npm test                      # testes de validacao de CPF
npm run test:fluxo            # fluxo completo contra o Supabase real
```

`npm run test:fluxo` sobe tres contas de teste, abre uma chamada, percorre os
cinco passos pelo painel do operador e confere o debito na carteira — tudo com a
mesma chave anon que o aplicativo usa, sem atalho de service_role. Se passar ali,
passa no app. Ele avisa o que falta preparar (operador autorizado, saldo) e
imprime o SQL pronto.

## Banco de dados

Projeto em uso: **REDE27**, regiao `sa-east-1` (Sao Paulo).
Aplicar na ordem, pelo SQL Editor do Supabase ou pela CLI:

1. `0001_init.sql` — tabelas, RLS, carteira e protocolo
2. `0002_operadores.sql` — papel de operador do painel
3. `0003_realtime_e_permissoes.sql` — publica `corridas` no Realtime e fecha as RPCs para `anon`
4. `0004_corrige_eh_operador.sql` — conserta a leitura de `corridas` (ver aviso abaixo)
5. `0005_revoga_eh_operador_anon.sql` — tira `eh_operador` do alcance do papel anonimo

> **Cuidado ao mexer em permissoes de funcao.** As policies de SELECT de
> `corridas` e `corrida_eventos` chamam `public.eh_operador()`, e a expressao de
> uma policy roda com os direitos de **quem consulta**, nao do dono da tabela.
> Revogar `EXECUTE` dessa funcao do papel `authenticated` derruba toda leitura
> de corridas com `permission denied for function eh_operador` — a tela 3 e o
> painel do motorista param juntos. Foi exatamente o que aconteceu entre a
> 0003 e a 0004.

Depois, autorizar a conta que vai usar o painel do motorista:

```sql
insert into public.operadores (id, nome)
select id, 'Painel REDE27'
  from auth.users
 where email = '<cpf-com-11-digitos>@rede27.app'   -- ver CPF.dominioLogin
on conflict (id) do update set ativo = true;
```

Creditar saldo na carteira de um passageiro (a recarga por pagamento fica para a
proxima fase):

```sql
select public.creditar_carteira(
  (select id from public.passageiros where cpf = '<cpf-com-11-digitos>'),
  5000,                       -- R$ 50,00, em centavos
  'Credito promocional'
);
```

### Configuracao necessaria no painel do Supabase

Dois ajustes **obrigatorios**, sem os quais nenhum cadastro funciona. Nao da
para faze-los por SQL nem por migracao — sao do painel.

**1. Desligar a confirmacao de e-mail.**
Em **Authentication -> Sign In / Providers -> Email**, desligar *Confirm email*.

O login e por CPF: cada CPF vira um endereco interno `<cpf>@<dominio>` que o
passageiro nunca ve. Com a confirmacao ligada, o Supabase tenta **enviar** um
e-mail para esse endereco, o que (a) trava no limite de envio do SMTP padrao —
`email rate limit exceeded` ja no terceiro cadastro — e (b) deixa o passageiro
sem sessao esperando um link que nunca chega.

**2. Conferir o dominio de login.**
O Supabase recusa dominios que nao resolvem no DNS. `passageiro.rede27.app` foi
recusado com `Email address ... is invalid`. O dominio usado fica em
`CPF.dominioLogin` (`src/config/rede27.config.ts`) — o ideal e apontar para um
dominio real da REDE27.

## Seguranca da carteira

O saldo **nunca** e escrito pelo aplicativo. Nao existe policy de `update` em
`carteiras`. Toda movimentacao passa por funcoes `security definer` no banco:

- `criar_corrida` — calcula o preco no servidor e confere o saldo antes de abrir;
- `avancar_protocolo` — so operador autorizado avanca; no passo 5 debita e encerra;
- `cancelar_corrida` — so o dono da chamada cancela;
- `creditar_carteira` — administrativa, sem permissao para `anon`/`authenticated`.

As linhas sao travadas com `for update`, entao dois toques simultaneos nao
debitam duas vezes.

## Precos

Ficam na tabela `categorias`, em centavos. O cliente ajusta por SQL ou pela
interface do Supabase e o app passa a usar o valor novo **sem republicar**.
Os valores em `src/config/rede27.config.ts` sao apenas o fallback offline.

## Entrega

```bash
npm run build:web             # gera dist/ — hospedar em qualquer servidor estatico
npx eas build -p android --profile preview   # gera o APK na nuvem
```

Publicacao na Play Store nao entra nesta fase: contas novas passam por um
periodo de teste fechado exigido pelo Google.

## Estado da verificacao

| O que | Como foi verificado |
| --- | --- |
| Validacao de CPF | 10 testes unitarios (`npm test`) |
| Telas e navegacao | versao web dirigida em navegador real, sem erro de console |
| Trava 03 | soltar em 1s nao chama; segurar os 3s chama |
| Fluxo completo | `npm run test:fluxo` — 29 verificacoes, todas passando |
| Tempo real | operador avancou os 5 passos e a tela do passageiro acompanhou sem recarregar |
| Isolamento | passageiro nao le nem avanca corrida alheia; `anon` barrado em 13 tentativas |

## Pontos ainda em aberto

Tudo que depende de resposta do cliente esta reunido em
`src/config/rede27.config.ts` e listado em [docs/PENDENCIAS.md](docs/PENDENCIAS.md).
