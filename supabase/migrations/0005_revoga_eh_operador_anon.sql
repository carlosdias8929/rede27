-- ===========================================================================
-- REDE27 — tira `eh_operador` do alcance do papel anonimo
--
-- `create or replace function` reconcede EXECUTE a PUBLIC, entao a funcao
-- recriada em 0004 voltou a ficar exposta em /rest/v1/rpc/eh_operador para o
-- papel `anon`. Sem sessao ela sempre responde false (auth.uid() e nulo), mas
-- nao ha motivo para deixar a rota aberta.
--
-- O grant explicito para `authenticated` continua valendo, e ele e obrigatorio:
-- as policies de SELECT de `corridas` e `corrida_eventos` chamam esta funcao e
-- sao avaliadas com os direitos de quem consulta (ver 0004).
-- ===========================================================================

revoke all on function public.eh_operador() from public;
revoke all on function public.eh_operador() from anon;
grant execute on function public.eh_operador() to authenticated;
