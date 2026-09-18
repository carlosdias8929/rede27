-- ===========================================================================
-- REDE27 — operadores (painel do motorista)
--
-- Nesta fase quem recebe a chamada e um painel web simples. Sem este arquivo,
-- qualquer passageiro autenticado conseguiria avancar a corrida de outro ate o
-- passo 5 e disparar o debito na carteira alheia. Aqui separamos os papeis:
--   - passageiro: cria e cancela a propria chamada;
--   - operador:   ve a fila de chamadas abertas e avanca o protocolo.
-- ===========================================================================

create table if not exists public.operadores (
  id        uuid primary key references auth.users (id) on delete cascade,
  nome      text        not null default '',
  ativo     boolean     not null default true,
  criado_em timestamptz not null default now()
);

comment on table public.operadores is
  'Contas autorizadas a operar o painel do motorista. Cadastro manual pela administracao.';

alter table public.operadores enable row level security;

-- O operador consegue conferir o proprio cadastro; ninguem se auto-cadastra.
drop policy if exists operadores_proprio_select on public.operadores;
create policy operadores_proprio_select on public.operadores
  for select to authenticated using (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Quem e operador
-- ---------------------------------------------------------------------------
create or replace function public.eh_operador(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.operadores
     where id = p_uid and ativo
  );
$fn$;

grant execute on function public.eh_operador(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- O operador enxerga a fila de chamadas
-- ---------------------------------------------------------------------------
drop policy if exists corridas_operador_select on public.corridas;
create policy corridas_operador_select on public.corridas
  for select to authenticated
  using (public.eh_operador((select auth.uid())));

drop policy if exists corrida_eventos_operador_select on public.corrida_eventos;
create policy corrida_eventos_operador_select on public.corrida_eventos
  for select to authenticated
  using (public.eh_operador((select auth.uid())));

-- ---------------------------------------------------------------------------
-- Avancar o protocolo passa a exigir papel de operador
-- ---------------------------------------------------------------------------
create or replace function public.avancar_protocolo(
  p_corrida_id uuid,
  p_chave text default '',
  p_motorista_nome text default null
)
returns public.corridas
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
  v_corrida public.corridas;
  v_carteira_id uuid;
  v_saldo bigint;
  v_proximo smallint;
begin
  if v_uid is null then
    raise exception 'Sessao expirada. Entre novamente.';
  end if;

  -- Somente o operador avanca o protocolo. O passageiro so cancela.
  if not public.eh_operador(v_uid) then
    raise exception 'Sem permissao para avancar esta chamada.';
  end if;

  select * into v_corrida from public.corridas
   where id = p_corrida_id
     for update;

  if v_corrida is null then
    raise exception 'Chamada nao encontrada.';
  end if;

  if v_corrida.status <> 'aberta' then
    raise exception 'Esta chamada ja foi encerrada.';
  end if;

  v_proximo := v_corrida.passo_atual + 1;

  if v_proximo > 5 then
    raise exception 'Protocolo ja concluido.';
  end if;

  update public.corridas
     set passo_atual = v_proximo,
         motorista_nome = coalesce(p_motorista_nome, motorista_nome),
         atualizada_em = now()
   where id = p_corrida_id
  returning * into v_corrida;

  insert into public.corrida_eventos (corrida_id, passo, chave)
  values (v_corrida.id, v_proximo, coalesce(nullif(p_chave, ''), 'passo_' || v_proximo));

  -- Passo 5: servico concluido -> debita a carteira e encerra.
  if v_proximo = 5 then
    select id, saldo_centavos into v_carteira_id, v_saldo
      from public.carteiras
     where passageiro_id = v_corrida.passageiro_id
       for update;

    if v_carteira_id is null then
      raise exception 'Carteira nao encontrada.';
    end if;

    if v_saldo < v_corrida.valor_estimado_centavos then
      raise exception 'Saldo insuficiente para concluir o servico.';
    end if;

    update public.carteiras
       set saldo_centavos = saldo_centavos - v_corrida.valor_estimado_centavos,
           atualizado_em = now()
     where id = v_carteira_id;

    insert into public.transacoes (carteira_id, tipo, valor_centavos, descricao, corrida_id)
    values (
      v_carteira_id, 'debito', v_corrida.valor_estimado_centavos,
      'Servico REDE27 - ' || v_corrida.destino_texto, v_corrida.id
    );

    update public.corridas
       set status = 'concluida',
           valor_final_centavos = v_corrida.valor_estimado_centavos,
           atualizada_em = now()
     where id = p_corrida_id
    returning * into v_corrida;
  end if;

  return v_corrida;
end;
$fn$;

grant execute on function public.avancar_protocolo(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Como autorizar um operador (executar no SQL Editor do Supabase):
--
--   insert into public.operadores (id, nome)
--   select id, 'Painel REDE27'
--     from auth.users
--    where email = '<cpf-com-11-digitos>@rede27.app'   -- ver CPF.dominioLogin
--   on conflict (id) do update set ativo = true;
-- ---------------------------------------------------------------------------
