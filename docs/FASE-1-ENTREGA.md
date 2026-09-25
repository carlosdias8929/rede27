# Fase 1 — lista de entrega

REDE 27 · REDE BRASIL HOJE LTDA · CNPJ 62.142.941/0001-17

Lista item a item do que a Fase 1 entrega, e o que está fora dela. Serve como
conferência para o aceite.

---

## Aplicativo do passageiro

**1. Login e cadastro por CPF**
Validação do CPF no próprio aparelho — formato, 11 dígitos e os dois dígitos
verificadores da Receita Federal. CPF inválido nem chega ao servidor.

**2. Carteira com saldo e extrato**
Saldo, histórico de créditos e débitos. O saldo nunca é escrito pelo aplicativo:
toda movimentação passa por função protegida no banco.

**3. Destino por digitação ou por voz**
O microfone do próprio teclado funciona no campo de destino, sem tela extra e
sem permissão adicional. No navegador, o botão de microfone dita direto.

**4. Busca de endereço com sugestões**
Lista de endereços ao digitar, ancorada na cidade escolhida.

**5. Três categorias com preço próprio**
Sem ar (R$ 7,00 + R$ 2,50/km), Com ar (R$ 10,00 + R$ 3,00/km) e Transporte de
Bens (R$ 12,00 + R$ 3,50/km). Todos editáveis no painel.

**6. Cálculo de distância e preço por km**
Distância estimada por coordenadas, com fator de correção e distância mínima,
ambos editáveis. O preço é calculado no servidor, não no aparelho.

**7. Escolha da forma de pagamento**
Carteira ou dinheiro.

**8. Dinheiro com troco automático**
Campo "Vai pagar com R$" e o troco calculado na hora. O servidor recusa valor
menor que o da corrida.

**9. Botão CHAMAR**

**10. Protocolo 03 — botão de emergência**
O passageiro segura 3 segundos e a central recebe o alerta com a localização.
Silencioso para o motorista: ele não tem permissão de ver o alerta no sistema.

**11. Acompanhamento da corrida em tempo real**
Os cinco passos do serviço, atualizando sozinhos. Se a conexão cair, a tela se
corrige em segundos em vez de congelar.

**12. Foto e dados do motorista durante a corrida**
Foto de perfil, foto do veículo, nome e placa.

**13. Saudações**
"Bem-vindo à REDE BRASIL HOJE", "Você chegou no local", "Você chegou no
endereço" e "Obrigado por usar".

---

## Painel do motorista

**14. Conta própria do motorista**
O motorista se cadastra sozinho, com CPF e senha.

**15. Cadastro com foto obrigatória**
Foto de perfil e foto do veículo. Sem as duas, o sistema recusa aceitar corrida
— a trava é no banco de dados, não na tela.

**16. Edição do próprio perfil**
Trocar carro, telefone ou foto a qualquer momento.

**17. Fila de chamadas e execução da corrida**
Ver chamadas disponíveis, aceitar, avançar os passos e ver quanto recebe ao
final. Em corrida paga em dinheiro, mostra quanto levar de troco e quanto
repassar à empresa.

---

## Painel Admin

**18. Alertas do Protocolo 03**
Alerta vermelho piscando com aviso sonoro, localização com link para o mapa,
botões para ligar ao passageiro e ao motorista, e para encerrar. Todo o
histórico fica registrado.

**19. Corridas e faturamento**
Histórico completo, com quanto é da empresa e quanto é do motorista em cada
corrida, e os totais.

**20. Carteiras**
Lançar saldo para qualquer passageiro, com limite por lançamento.

**21. Preços e taxa**
Editar os valores de cada categoria, a taxa da empresa e o fator de distância.
A taxa tem piso de 25% travado no banco: nenhuma tela e nenhum atalho gravam
abaixo disso.

**22. Empresa e chaves PIX**
Razão social, CNPJ e chaves PIX editáveis. Trocar qualquer um deles não exige
nova versão do aplicativo.

**23. Cidades**
Cadastro ilimitado de cidades.

**24. Motoristas**
Lista de motoristas, quem está ativo e quem completou o cadastro.

---

## Entregues junto

**25. APK Android** instalável, com ícone próprio da REDE 27.

**26. Versão web** dos três produtos, no mesmo endereço.

**27. Código-fonte completo**, com as instruções de build.

**28. Banco de dados** com 15 migrações versionadas, controle de acesso por
papel e as regras de dinheiro protegidas no servidor.

**29. Teste automatizado** (`npm run test:fluxo`): 79 verificações contra o
banco real, incluindo as regras de dinheiro e de permissão.

---

## Fora da Fase 1

Combinado ao longo do projeto e detalhado em [FASE-2-ESCOPO.md](FASE-2-ESCOPO.md):

- **tela de mapa e rastreamento do carro** — a Fase 1 não tem mapa;
- **distância por rota de rua** — hoje é estimada, com fator de correção;
- **partida e chegada automáticas por GPS** e avisos de 2 km, 1 km, 500 m;
- **gateway de pagamento**, cartão, PIX automático e divisão automática do
  dinheiro — a Fase 1 calcula e registra o rateio, o repasse é feito por vocês;
- **publicação na Play Store**;
- **gravação de áudio no 03** e ligação automática para a polícia.

---

## O que este projeto não usa

Para evitar confusão nos acessos:

- **não usa Firebase.** O backend é Supabase, conforme alinhado antes de
  começar. Não existe conta Firebase para entregar.
- **não usa Google Maps.** O endereço vem do OpenStreetMap, gratuito e sem
  chave de API. Não existe chave do Google Maps para entregar — ela passa a
  existir no Módulo A da Fase 2.
