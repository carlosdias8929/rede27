# Acessos, propriedade e transferência

REDE 27 · REDE BRASIL HOJE LTDA · CNPJ 62.142.941/0001-17

O que existe, de quem é hoje, se é definitivo ou provisório, e como passa para
o nome da empresa.

---

## Resumo

| Item | Situação | Definitivo? | Como transferir |
| --- | --- | --- | --- |
| Banco de dados (Supabase) | funcionando | **definitivo** | a empresa cria a conta e recebe o projeto |
| Link de teste (Netlify) | funcionando | **provisório** | a empresa cria a conta e recebe o site, ou aponta domínio próprio |
| APK Android | entregue | **definitivo** | já está com vocês |
| Chave de assinatura (.jks) | entregue | **definitivo** | já está com vocês — guardem com cuidado |
| Código-fonte | entregue | **definitivo** | já está com vocês |
| Firebase | **não existe** | — | o projeto não usa Firebase |
| Google Maps | **não existe** | — | entra no Módulo A da Fase 2 |
| Google Play | **não publicado** | — | entra no Módulo C da Fase 2 |

---

## 1. Banco de dados — Supabase

É onde ficam os cadastros, as corridas, as carteiras e os alertas do 03. É o
coração do sistema e é **definitivo**: não muda na Fase 2.

**Como passar para o nome da empresa:**

1. A REDE BRASIL HOJE cria uma conta em supabase.com, com um e-mail da empresa
   (não um pessoal — se a pessoa sair, o acesso sai junto);
2. Na conta criada, convidar `carlosdias8929@gmail.com` como membro da
   organização, com permissão de administrador;
3. Aviso quando a transferência do projeto estiver concluída.

A partir daí a empresa é a dona: paga (hoje o plano usado é gratuito), controla
quem tem acesso e pode remover qualquer pessoa, inclusive o desenvolvedor.

**Chaves do sistema:** existem duas. A pública já vai dentro do aplicativo e não
dá acesso a nada além do que as regras permitem. A privada nunca saiu do
servidor e não é usada pelo aplicativo. Ambas ficam visíveis no painel do
Supabase depois da transferência.

---

## 2. Link de teste — Netlify

`https://rede27.netlify.app`

**É provisório.** Não tem prazo de validade e não expira sozinho, mas:

- é um endereço gratuito da Netlify, terminado em `.netlify.app`;
- hoje está na conta do desenvolvedor;
- serve para testar, não para divulgar a clientes.

**Duas formas de resolver:**

*Transferir o site:* a empresa cria conta na Netlify e o site é transferido.
O endereço continua sendo `rede27.netlify.app`.

*Usar domínio próprio (recomendado):* a empresa registra um domínio — por
exemplo `rede27.com.br` ou `redebrasilhoje.com.br` — e o site passa a atender
nele. Custa cerca de R$ 40 por ano no registro.br. O domínio fica no CNPJ da
empresa, e é dele que ninguém tira vocês.

O domínio próprio também resolve outro ponto: o login por CPF usa um endereço
interno que hoje aponta para um domínio que não é de vocês. Com domínio
próprio, isso passa a ser de vocês também.

---

## 3. APK e chave de assinatura

O APK está entregue e instalável.

A **chave de assinatura (.jks)** também foi entregue e merece um aviso: ela é
insubstituível. É com ela que o Android reconhece que uma atualização veio do
mesmo dono. **Se essa chave for perdida, não existe recuperação** — nem o
Google restaura. Seria preciso publicar um aplicativo novo, e todo mundo teria
de reinstalar.

Guardem em pelo menos dois lugares, um deles fora do computador de trabalho.

---

## 4. Firebase — não existe

O projeto **não usa Firebase**. O backend é Supabase, decidido antes de começar:
banco relacional deixa a carteira e o dinheiro mais consistentes.

Não existe conta, chave ou acesso do Firebase para entregar.

---

## 5. Google Maps — não existe nesta fase

A Fase 1 **não tem mapa**. O endereço vem do OpenStreetMap, que é gratuito e não
exige chave de API, e a distância é estimada por coordenadas com um fator de
correção.

Portanto **não existe chave do Google Maps para entregar**. Ela passa a existir
no Módulo A da Fase 2, e depende de a empresa abrir uma conta de faturamento no
Google Cloud com o CNPJ.

---

## 6. Google Play — não publicado

O aplicativo **não está na Play Store**. A instalação é pelo APK.

A publicação é o Módulo C da Fase 2 e depende de: conta de desenvolvedor da
empresa, taxa única de US$ 25 paga ao Google, e o período de **teste fechado
obrigatório para contas novas**, cujo prazo é definido pelo Google.

---

## 7. Contas de teste

Ficam no arquivo `ACESSO-TESTE.txt`, entregue junto. São contas de demonstração
— para operar de verdade, cada pessoa cria a sua pelo aplicativo.

A conta de administrador é a única que não se cria sozinha: alguém já
administrador precisa autorizar. É proposital, para ninguém se promover.

---

## Checklist da transferência

- [ ] Empresa cria conta no Supabase com e-mail corporativo
- [ ] Empresa convida `carlosdias8929@gmail.com` como administrador
- [ ] Projeto transferido e confirmado
- [ ] Empresa registra o domínio próprio (opcional, recomendado)
- [ ] Site apontado para o domínio da empresa
- [ ] Chave .jks guardada em dois lugares seguros
- [ ] Conta de administrador criada no CPF do responsável da empresa
