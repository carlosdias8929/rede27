-- ===========================================================================
-- REDE27 — corrige o acesso as corridas
--
-- A migracao 0003 revogou EXECUTE em `eh_operador` do papel `authenticated`,
-- partindo de uma premissa errada: a de que policies rodam com os direitos do
-- dono da tabela. Nao rodam — a expressao da policy e avaliada com os direitos
-- de quem consulta. Como duas policies de SELECT chamam a funcao, TODA leitura
-- autenticada de `corridas` e `corrida_eventos` passou a falhar com
-- "permission denied for function eh_operador", derrubando a tela 3 e o painel.
--
-- Aproveitamos para fechar o buraco que a revogacao tentava tapar: a funcao
-- deixa de aceitar um uuid e passa a olhar sempre `auth.uid()`. Assim ninguem
-- consegue perguntar "fulano e operador?" — so da para saber sobre si mesmo.
-- ===========================================================================

create or replace function public.eh_operador()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.operadores
     where id = auth.uid() and ativo
  );
$fn$;

grant execute on function public.eh_operador() to authenticated;

-- Policies passam a usar a versao sem argumento.
drop policy if exists corridas_operador_select on public.corridas;
create policy corridas_operador_select on public.corridas
  for select to authenticated
  using (public.eh_operador());

drop policy if exists corrida_eventos_operador_select on public.corrida_eventos;
create policy corrida_eventos_operador_select on public.corrida_eventos
  for select to authenticated
  using (public.eh_operador());

-- `avancar_protocolo` tambem chamava a versao com argumento. Como e
-- SECURITY DEFINER, ela roda com os direitos do dono e nunca chegou a quebrar,
-- mas fica alinhada com a nova assinatura.
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
  v_corrida public.corridas;
  v_carteira_id uuid;
  v_saldo bigint;
  v_proximo smallint;
begin
  if auth.uid() is null then
    raise exception 'Sessao expirada. Entre novamente.';
  end if;

  if not public.eh_operador() then
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

-- A versao antiga sai de circulacao.
drop function if exists public.eh_operador(uuid);
