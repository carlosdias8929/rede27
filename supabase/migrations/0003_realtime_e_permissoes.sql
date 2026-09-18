-- ===========================================================================
-- REDE27 — Realtime e permissoes de execucao
--
-- Dois ajustes que o projeto novo exige e que nao aparecem no schema:
--
-- 1. Realtime: a tela 3 e o painel do motorista acompanham `corridas` por
--    postgres_changes. Sem a tabela na publicacao `supabase_realtime`, a
--    assinatura conecta e simplesmente nunca recebe evento — falha silenciosa.
--
-- 2. Permissoes: o Postgres concede EXECUTE a PUBLIC em toda funcao nova. Isso
--    deixava as funcoes SECURITY DEFINER acessiveis pelo papel `anon` via
--    /rest/v1/rpc/... Nenhuma delas faz nada util sem sessao (todas barram em
--    auth.uid() nulo), mas `eh_operador` permitia descobrir se um uuid e
--    operador. Aqui fechamos a porta em vez de confiar na checagem interna.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Realtime
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'corridas'
  ) then
    alter publication supabase_realtime add table public.corridas;
  end if;
end;
$$;

-- O app le `payload.new` e filtra por id, entao a identidade padrao (chave
-- primaria) basta. Deixamos explicito para nao depender do default.
alter table public.corridas replica identity default;

-- ---------------------------------------------------------------------------
-- 2. Permissoes de execucao
-- ---------------------------------------------------------------------------

-- Funcao de gatilho: nunca deve ser chamada como RPC. O gatilho continua
-- funcionando — o Postgres checa permissao de funcao de gatilho na criacao do
-- gatilho, nao a cada disparo.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- RPCs do aplicativo: somente usuario autenticado.
revoke all on function public.criar_corrida(text, text, text, numeric) from public, anon;
grant execute on function public.criar_corrida(text, text, text, numeric) to authenticated;

revoke all on function public.avancar_protocolo(uuid, text, text) from public, anon;
grant execute on function public.avancar_protocolo(uuid, text, text) to authenticated;

revoke all on function public.cancelar_corrida(uuid) from public, anon;
grant execute on function public.cancelar_corrida(uuid) to authenticated;

-- Auxiliar usada nas policies. As policies rodam com os direitos do dono, entao
-- nao precisa estar exposta na API.
revoke all on function public.eh_operador(uuid) from public, anon, authenticated;

-- Credito de carteira: operacao administrativa, fora da API.
revoke all on function public.creditar_carteira(uuid, bigint, text) from public, anon, authenticated;
