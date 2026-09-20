# Fase 2 — escopo e orçamento

Documento de referência para fechar a Fase 2 do REDE 27 / REDE BRASIL HOJE.
Tudo aqui saiu de pedidos do próprio cliente, ao longo das mensagens.

> **Regra que vale para os dois lados:** o que não estiver escrito neste
> documento não está contratado. Item novo entra por acréscimo, com valor e
> prazo próprios. A Fase 1 passou por quatro rodadas de itens novos depois de
> fechada; este documento existe para isso não se repetir.

---

## Onde a Fase 1 parou

Entregue e testado: aplicativo do passageiro (APK + web), painel do motorista,
painel Admin, login por CPF, carteira, dinheiro com troco, protocolo 03 com
alerta em tempo real, taxa de 25% travada no banco, preços e cidades editáveis.

O que a Fase 1 **não** faz, por decisão combinada:

- não tem tela de mapa, nem rastreamento do carro;
- a distância é estimada em linha reta com fator de correção, não medida por rua;
- o motorista confirma embarque e chegada com um toque, não por GPS;
- não movimenta dinheiro: calcula e registra o rateio, o repasse é manual;
- não está publicado na Play Store.

A Fase 2 é exatamente sobre isso.

---

## Módulo A — Mapa e corrida automática

O "igual Uber" que o cliente descreveu: sem clique de partida e chegada, com
aviso de aproximação.

- tela de mapa com a posição do motorista, atualizada ao vivo;
- rota desenhada entre origem e destino;
- **distância e preço por rota real de rua**, no lugar da estimativa em linha reta;
- partida e chegada detectadas por GPS, sem o motorista tocar em nada;
- avisos de aproximação: 2 km, 1 km, 500 m, "chega em 2 minutos" e "CHEGOU";
- notificações no celular, mesmo com o aplicativo fechado;
- rastreamento em segundo plano enquanto a corrida está acontecendo.

**Depende do cliente:** conta de faturamento no Google Maps, no CNPJ da empresa.
O Google cobra por consulta; hoje o uso ficaria dentro da cota gratuita mensal,
mas a conta precisa existir e o cartão precisa estar cadastrado.

**Observação técnica honesta:** rastrear com o aplicativo fechado exige a
permissão de localização em segundo plano do Android, e o Google revisa esse
pedido caso a caso na publicação. É concedida para aplicativos de transporte,
mas o prazo da revisão é do Google, não meu.

**R$ 1.800**

---

## Módulo B — Pagamento integrado

O que o cliente pediu ao dizer que a carteira tem que funcionar com gateway.

- integração com uma empresa de pagamentos (Mercado Pago, Asaas ou Pagar.me);
- cartão de crédito e PIX automático dentro do aplicativo;
- o passageiro recarrega a própria carteira, sem depender da central;
- **divisão automática:** 25% para a conta da REDE BRASIL e 75% para a do
  motorista, na hora da corrida;
- conciliação no painel: o que entrou, o que foi repassado, o que está pendente.

**Depende do cliente:** cadastro aprovado na empresa de pagamentos, no CNPJ
62.142.941/0001-17, com conta bancária vinculada. Esse cadastro é feito pela
REDE BRASIL — nenhum desenvolvedor abre conta ou contrata gateway no nome de
outra empresa. Eu integro depois que estiver aprovado.

**R$ 1.500**

---

## Módulo C — Publicação na Play Store

- conta de desenvolvedor, ficha do aplicativo, textos e imagens da loja;
- política de privacidade e formulário de segurança de dados;
- build assinado e envio;
- acompanhamento até a aprovação.

**Depende do cliente:** taxa única de US$ 25 do Google, paga por vocês, e o
período de **teste fechado obrigatório para contas novas** — o Google exige um
grupo de testadores por um período antes de liberar ao público. Esse prazo é
do Google e não há como encurtar.

**R$ 400**

---

## Módulo D — Protocolo 03 avançado

O que ficou de fora do 03 na Fase 1, por combinação.

- gravação de áudio ao acionar o 03, guardada junto do alerta;
- localização contínua enquanto o alerta estiver ativo, não só no acionamento;
- histórico de alertas com áudio e trajeto para a central revisar depois.

**Não inclui** ligação automática para a polícia. Isso não é uma integração que
se contrate: não existe API pública do 190, e um sistema que disca para a
emergência sem uma pessoa decidindo gera trote e responsabilidade civil. O 03
continua avisando a central de vocês, que liga se for o caso.

**R$ 700**

---

## Resumo

| Módulo | O que entrega | Valor |
| --- | --- | --- |
| A | Mapa, rastreamento e corrida automática por GPS | R$ 1.800 |
| B | Gateway, cartão, PIX automático e divisão 25/75 | R$ 1.500 |
| C | Publicação na Play Store | R$ 400 |
| D | Protocolo 03 com áudio e rastreamento contínuo | R$ 700 |
| | **Tudo** | **R$ 4.400** |

Os módulos são independentes e podem ser contratados separadamente, na ordem
que o cliente preferir.

**Recomendação:** começar pelo **Módulo A**. É o que muda a experiência de quem
usa e o que o cliente descreveu como "igual Uber". O Módulo B depende de um
cadastro que leva dias para ser aprovado, e o C depende do prazo do Google —
os dois podem correr em paralelo enquanto o A é construído.

---

## Prazos

Contados a partir do aceite do acréscimo na Workana e da entrega do que depende
do cliente.

| Módulo | Prazo |
| --- | --- |
| A | 5 a 7 dias |
| B | 4 a 5 dias após o cadastro no gateway estar aprovado |
| C | 1 dia de trabalho + o período de teste exigido pelo Google |
| D | 3 dias |

---

## Condição para iniciar

A Fase 1 está entregue: APK, código-fonte, os dois painéis e o ambiente de
teste no ar. A Fase 2 começa depois que os fundos da Fase 1 forem liberados na
Workana.

Não é desconfiança — é a ordem normal: uma etapa fecha antes de a próxima
começar.
