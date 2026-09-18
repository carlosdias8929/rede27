-- ===========================================================================
-- REDE27 — a conclusao da corrida vira um unico UPDATE
--
-- `avancar_protocolo` escrevia duas vezes em `corridas` no passo 5: primeiro o
-- passo, depois o status, o valor final e o rateio. Sao dois eventos de
-- Realtime, e entre eles existe um estado publicado que nao faz sentido para
-- quem esta olhando: "passo 5 de 5" com status ainda 'aberta'.
--
-- Se o segundo evento se perde — aba em segundo plano, oscilacao de rede,
-- socket derrubado — a tela do passageiro fica exatamente nesse meio: avancou
-- o passo, mas nunca mostra "CONCLUIDA".
--
-- Agora o passo 5 grava tudo de uma vez: ou a corrida chega concluida, ou nao
-- chega. Nao existe mais meio-termo para se perder.
-- ===========================================================================

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
  v_taxa numeric;
  v_empresa bigint;
begin
  if v_uid is null then
    raise exception 'Sessao expirada. Entre novamente.';
  end if;

  select * into v_corrida from public.corridas
   where id = p_corrida_id
     for update;

  if v_corrida.id is null then
    raise exception 'Chamada nao encontrada.';
  end if;

  if not public.eh_admin() and v_corrida.motorista_id is distinct from v_uid then
    raise exception 'Sem permissao para avancar esta chamada.';
  end if;

  if v_corrida.status <> 'aberta' then
    raise exception 'Esta chamada ja foi encerrada.';
  end if;

  v_proximo := v_corrida.passo_atual + 1;

  if v_proximo > 5 then
    raise exception 'Protocolo ja concluido.';
  end if;

  if v_proximo = 2 and v_corrida.motorista_id is null then
    raise exception 'Use aceitar_corrida para atribuir um motorista.';
  end if;

  -- Passos 2 a 4: so anda o passo.
  if v_proximo < 5 then
    update public.corridas
       set passo_atual = v_proximo,
           motorista_nome = coalesce(p_motorista_nome, motorista_nome),
           atualizada_em = now()
     where id = p_corrida_id
    returning * into v_corrida;

    insert into public.corrida_eventos (corrida_id, passo, chave)
    values (v_corrida.id, v_proximo, coalesce(nullif(p_chave, ''), 'passo_' || v_proximo));

    return v_corrida;
  end if;

  -- Passo 5: debita, rateia e encerra — tudo num UPDATE so.
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

  -- A taxa gravada na corrida manda: mudar o percentual no Admin nao pode
  -- reescrever o passado.
  v_taxa := coalesce(v_corrida.taxa_empresa_percentual,
                     public.config_num('taxa_empresa_percentual', 25));
  v_empresa := round(v_corrida.valor_estimado_centavos * v_taxa / 100.0)::bigint;

  update public.corridas
     set passo_atual = 5,
         status = 'concluida',
         motorista_nome = coalesce(p_motorista_nome, motorista_nome),
         valor_final_centavos = v_corrida.valor_estimado_centavos,
         taxa_empresa_percentual = v_taxa,
         valor_empresa_centavos = v_empresa,
         valor_motorista_centavos = v_corrida.valor_estimado_centavos - v_empresa,
         atualizada_em = now()
   where id = p_corrida_id
  returning * into v_corrida;

  insert into public.corrida_eventos (corrida_id, passo, chave)
  values (v_corrida.id, 5, coalesce(nullif(p_chave, ''), 'servico_concluido'));

  return v_corrida;
end;
$fn$;

revoke all on function public.avancar_protocolo(uuid, text, text) from public, anon;
grant execute on function public.avancar_protocolo(uuid, text, text) to authenticated;
