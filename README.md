# REDE27

Transporte de passageiros, bens e encomendas. **Três produtos, um código:**

| Produto | Rota | Para quem |
| --- | --- | --- |
| App do passageiro | `/login` → `/inicio` → `/corrida` | APK Android e web |
| Painel do motorista | `/motorista` | web |
| Painel Admin | `/admin` | web |

## Stack

| Camada | Escolha | Por quê |
| --- | --- | --- |
| App | Expo SDK 57 + React Native + expo-router | um código gera o APK e os painéis web |
| Backend | Supabase (Postgres + Auth + Realtime + Storage) | banco relacional deixa a carteira consistente |
| Mapa | Nominatim (OpenStreetMap) + Haversine | gratuito e provisório, conforme combinado |
| Build APK | EAS Build (nuvem) | não exige Android SDK/JDK na máquina |

## Os dois fluxos de cinco passos

São coisas diferentes, e confundi-las já custou retrabalho uma vez.

**Protocolo 03 — botão de pânico** (`alertas_03`)

1. Passageiro segura o 03 por 3 segundos
2. App envia localização + dados da corrida
3. Painel Admin mostra "PROTOCOLO 03 ATIVADO" em vermelho, com som
4. Admin liga para o passageiro e para o motorista
5. Admin encerra o alerta

**Ciclo da corrida** (`corridas`)

1. Chamada enviada → 2. Motorista aceitou → 3. Embarque confirmado →
4. Em deslocamento → 5. Serviço concluído (debita a carteira e faz o rateio)

> **O 03 é silencioso para o motorista.** O som toca só no painel Admin. Se o
> passageiro acionou por causa do motorista, um alarme no carro avisaria
> exatamente quem representa o risco. O motorista não tem permissão de leitura
> em `alertas_03` — isso é regra de banco, não de tela.

## Como rodar

```bash
npm install
cp .env.example .env          # URL e chave anon do Supabase
npm run web                   # desenvolvimento
npm run android               # app no aparelho/emulador
npm run typecheck
npm test                      # validação de CPF
npm run test:fluxo            # fluxo completo contra o Supabase real
```

`npm run test:fluxo` cria as contas dos três papéis, roda a corrida inteira,
aciona e encerra um protocolo 03 e confere o rateio — tudo com a mesma chave
anon dos apps, sem atalho de service_role. Ele avisa o que falta preparar e
imprime o SQL pronto.

## Banco de dados

Projeto **REDE27**, região `sa-east-1` (São Paulo). Aplicar em ordem:

| Migração | O que faz |
| --- | --- |
| `0001_init` | tabelas base, RLS, carteira, ciclo da corrida |
| `0002_operadores` | primeiro papel de operador do painel |
| `0003_realtime_e_permissoes` | publica `corridas` no Realtime, fecha RPCs para `anon` |
| `0004_corrige_eh_operador` | conserta leitura de corridas (ver aviso abaixo) |
| `0005_revoga_eh_operador_anon` | tira `eh_operador` do alcance anônimo |
| `0006_papeis_cidades_config` | motoristas, administradores, cidades, configurações |
| `0007_protocolo_03_e_corridas` | alertas 03, motorista na corrida, preço por km |
| `0008_cadastro_fotos_realtime` | cadastro por papel, Storage das fotos, Realtime dos alertas |
| `0009_distancia_km_search_path` | fixa `search_path` da função de distância |
| `0010_admin_le_passageiros` | Admin lê contato do passageiro (sem isso o passo 4 não funciona) |

> **Cuidado ao mexer em permissões de função.** Policies de SELECT chamam
> `eh_admin()`, `eh_motorista()` e afins, e a expressão de uma policy roda com
> os direitos de **quem consulta**, não do dono da tabela. Revogar `EXECUTE`
> dessas funções de `authenticated` derruba a leitura inteira com
> `permission denied for function ...`. Foi o que aconteceu entre a 0003 e a
> 0004. Além disso, `create or replace function` reconcede `EXECUTE` a `PUBLIC`
> — sempre revogue de novo depois de recriar.

### Configuração obrigatória no painel do Supabase

Não dá para fazer por SQL.

**1. Desligar "Confirm email"** em Authentication → Sign In / Providers → Email.
O login é por CPF, mapeado para `<cpf>@<domínio>`. Com a confirmação ligada, o
Supabase tenta *enviar* e-mail para esses endereços: trava no limite de envio
(`email rate limit exceeded`) e o usuário fica sem sessão.

**2. Conferir o domínio de login.** O Supabase recusa domínio que não resolve no
DNS — `passageiro.rede27.app` foi rejeitado. O valor está em `CPF.dominioLogin`
(`src/config/rede27.config.ts`).

### Criar um administrador

```sql
insert into public.administradores (id, nome)
select id, 'Central REDE27'
  from auth.users
 where email = '<cpf-com-11-digitos>@rede27.app'
on conflict (id) do update set ativo = true;
```

### Creditar a carteira de um passageiro

```sql
select public.creditar_carteira(
  (select id from public.passageiros where cpf = '<cpf-com-11-digitos>'),
  5000,                       -- R$ 50,00, em centavos
  'Credito promocional'
);
```

## Segurança da carteira e dos papéis

O saldo **nunca** é escrito pelo aplicativo — não existe policy de `update` em
`carteiras`. Toda movimentação passa por funções `security definer`:

- `criar_corrida` — calcula distância e preço no servidor e confere o saldo;
- `aceitar_corrida` — exige motorista ativo **com as duas fotos**;
- `avancar_protocolo` — só o motorista da corrida, ou um admin;
- `cancelar_corrida` — só o dono da chamada;
- `acionar_03` — só passageiro, e um alerta ativo por vez;
- `registrar_passo_03` / `encerrar_03` — só admin;
- `creditar_carteira` — administrativa, fora da API.

As linhas são travadas com `for update`, então toque duplo não debita duas vezes.

## Preço, taxa e cidades

Tudo editável no painel Admin, sem republicar:

- **Preços** por categoria (tabela `categorias`, em centavos);
- **Taxa da empresa** (`configuracoes.taxa_empresa_percentual`, hoje 25%). O
  rateio é gravado em cada corrida concluída — mudar o percentual não reescreve
  o passado;
- **Fator de rota** (`configuracoes.fator_rota`, hoje 1,3);
- **Cidades**, sem limite de quantidade.

**Distância é aproximada.** Sem API de rotas, usamos linha reta multiplicada
pelo fator de rota, com mínimo configurável. O app diz isso ao passageiro em vez
de fingir precisão. Quando entrar Google Maps (exige conta de faturamento do
cliente), sai só `src/lib/geo.ts` e a função `distancia_km` — o preço já é
calculado no servidor.

## Fotos do motorista

Bucket `motoristas` no Storage, **público para leitura** de propósito: a foto do
motorista e a do veículo existem para o passageiro ver. A escrita é restrita —
cada motorista só grava na pasta com o próprio id. A coluna
`motoristas.cadastro_completo` é calculada pelo banco e é ela que libera o
aceite de corridas.

## Entrega

```bash
npm run build:web             # dist/ — hospedar em qualquer servidor estático
npx eas build -p android --profile preview   # APK na nuvem
```

Publicação na Play Store não entra nesta fase: contas novas passam por um
período de teste fechado exigido pelo Google.

## Estado da verificação

| O que | Como foi verificado |
| --- | --- |
| Validação de CPF | 10 testes unitários (`npm test`) |
| Fluxo completo | `npm run test:fluxo` — 40+ verificações contra o banco real |
| Protocolo 03 | acionado fora do navegador e recebido no Admin sem recarregar |
| Papéis | motorista não lê alerta 03; passageiro não edita preço nem cidade |
| Fotos obrigatórias | aceite bloqueado enquanto faltar foto |
| Rateio | soma empresa + motorista fecha com o valor da corrida |
| Telas | os três produtos dirigidos em navegador real, sem erro de console |

## O que ficou para a fase 2

Gravação de áudio no 03, ligação automática para a polícia, rastreamento em
segundo plano, repasse automático ao motorista, recarga por pagamento, consulta
de CPF em base externa, API de rotas paga e publicação na Play Store.

Pendências abertas: [docs/PENDENCIAS.md](docs/PENDENCIAS.md).
