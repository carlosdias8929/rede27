# Pendencias do cliente — e o que foi assumido enquanto isso

Nenhuma das cinco perguntas bloqueou o desenvolvimento. Cada uma foi construida
com um padrao razoavel, isolado em `src/config/rede27.config.ts`. Quando a
resposta chegar, muda-se **uma linha** e nada mais precisa ser refeito.

---

## 1. Trava de seguranca "03"

**Pergunta:** codigo digitado, segurar o botao por 3 segundos, ou outra coisa?

**Situacao:** os **dois modos estao implementados e funcionando**. A escolha e
uma linha:

```ts
// src/config/rede27.config.ts
export const TRAVA_03 = {
  modo: 'SEGURAR_3S' as Trava03Modo,   // ou 'CODIGO_03'
```

| Modo | Comportamento |
| --- | --- |
| `SEGURAR_3S` (ativo) | Segurar CHAMAR por 3s; um preenchimento verde avanca e a chamada so sai ao completar. Soltar antes cancela. |
| `CODIGO_03` | Tocar em CHAMAR abre um campo; digitar `03` libera o botao de confirmar. |

Se a resposta for uma terceira coisa, o unico arquivo a mexer e
`src/components/BotaoChamar.tsx`.

**Acessibilidade:**

- No celular, com leitor de tela ativo, "segurar" nao e confiavel, entao o modo
  `SEGURAR_3S` troca sozinho por confirmacao em dois toques.
- Na web essa troca **nao** acontece, e de proposito: o react-native-web nao
  consegue detectar leitor de tela e responde sempre "tem leitor ativo", o que
  tirava a trava de 3 segundos de todo mundo que abrisse pelo navegador. Quem
  navega por teclado continua atendido: segurar `Enter` ou `Espaco` no botao
  conta como segurar o botao.

---

## 2. Os 5 passos do protocolo

**Pergunta:** quais sao exatamente os 5 passos?

**Situacao:** a **estrutura esta pronta** — cinco passos, avanco sequencial,
cada transicao gravada em `corrida_eventos`, tela 3 atualizando em tempo real.
Os **textos sao provisorios**:

1. Chamada enviada
2. Motorista aceitou
3. Embarque confirmado
4. Em deslocamento
5. Servico concluido *(debita a carteira e encerra)*

Trocar titulo e descricao em `PROTOCOLO_5_PASSOS` nao exige nenhuma outra
alteracao. **Unica amarra tecnica:** o passo 5 e o que fecha o servico e debita.
Se a ordem oficial puser o pagamento em outro ponto, avise — e um ajuste
pequeno, mas e no banco (`avancar_protocolo`), nao so no texto.

---

## 3. Quem recebe a chamada nesta fase

**Pergunta:** posso simular o motorista por um painel simples?

**Situacao:** feito, em `/motorista`. Mostra a fila de chamadas abertas em tempo
real e avanca o protocolo passo a passo. Nao entra nas 3 telas do passageiro.

O painel exige uma conta autorizada na tabela `operadores`. Isso nao e
burocracia: sem essa separacao, qualquer passageiro logado conseguiria avancar a
corrida de outra pessoa ate o passo 5 e **disparar o debito na carteira alheia**.

---

## 4. Precos por categoria

**Pergunta:** quais os precos de com ar, sem ar e transporte de bens?

**Situacao:** valores de exemplo, e **editaveis sem republicar o aplicativo** —
ficam na tabela `categorias` do Supabase, nao no codigo.

| Categoria | Tarifa base | Por km | Exemplo (3 km) |
| --- | --- | --- | --- |
| Com ar | R$ 8,00 | R$ 2,40 | R$ 15,20 |
| Sem ar | R$ 6,00 | R$ 1,90 | R$ 11,70 |
| Transporte de Bens | R$ 7,00 | R$ 2,10 | R$ 13,30 |

A distancia esta fixa em 3 km porque ainda nao ha calculo de rota por mapa —
isso e proxima fase, junto com o mapa em si.

---

## 5. Validacao de CPF e carteira

**Pergunta:** CPF so no formato ou contra base externa? Carteira com saldo
simples ou recarga por pagamento?

**Situacao:**

- **CPF: validacao algoritmica completa** — formato, 11 digitos e os dois
  digitos verificadores da Receita Federal, alem de bloquear sequencias como
  `111.111.111-11`. Roda no aparelho, antes de qualquer chamada de rede.
  Consulta a base externa (Serpro/parceiro) exige contrato e chave de API do
  cliente: proxima fase.
- **Carteira: saldo simples**, creditado pela administracao via SQL. Recarga por
  PIX/cartao e proxima fase — pede conta de recebimento e gateway.

---

## Combinado no chat e ja incluso

- **Voz no campo "Para onde vamos?"** — o campo e de texto livre e sem teclado
  restrito, entao o microfone do proprio teclado (Gboard no Android, ditado no
  iPhone) aparece normalmente. Sem permissao extra, sem tela extra, sem custo.
  Na web, onde o navegador oferece reconhecimento nativo, o botao de microfone
  dita direto no campo.
- **Categoria "Transporte de Bens"** — no lugar de "Miudeza", como terceira
  opcao ao lado de "Com ar" e "Sem ar", com preco proprio e o mesmo fluxo.
  Campos de encomenda (destinatario, tamanho, foto) ficam para a proxima etapa,
  conforme combinado.

## Fora do escopo desta fase

Mapa e rota real, app proprio de motorista, recarga por pagamento, consulta de
CPF em base externa, campos especificos de encomenda, publicacao na Play Store.
