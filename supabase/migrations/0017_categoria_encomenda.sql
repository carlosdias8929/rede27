-- ===========================================================================
-- REDE27 — "Transporte de Bens" passa a se chamar "Encomenda"
--
-- Pedido do cliente para encerrar a Fase 1. So o NOME exibido muda: a chave
-- `transporte_bens` continua a mesma, porque as corridas ja registradas e o
-- codigo apontam para ela. Preco, descricao e ordem nao mudam.
-- ===========================================================================

update public.categorias
   set nome = 'Encomenda',
       atualizado_em = now()
 where chave = 'transporte_bens';
