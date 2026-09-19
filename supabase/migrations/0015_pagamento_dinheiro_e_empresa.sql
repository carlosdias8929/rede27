-- ===========================================================================
-- REDE27 / REDE BRASIL — forma de pagamento com troco, e dados da empresa
--
-- 1. DINHEIRO COM TROCO
-- O cliente definiu: "campo Vai pagar com R$ / Troco R$". Entao a corrida passa
-- a ter forma de pagamento:
--
--   carteira -> debita do saldo no passo 5, como sempre foi;
--   dinheiro -> NAO debita nada. O passageiro paga na mao do motorista, e o
--               sistema so calcula o troco e registra quanto a empresa tem a
--               receber daquela corrida.
--
-- Em dinheiro, o motorista recebe 100% na mao e fica devendo a taxa a empresa.
-- Isso e o inverso da carteira, onde a empresa recebe e deve ao motorista.
-- Por isso o rateio e gravado do mesmo jeito nos dois casos: o painel precisa
-- saber quem deve a quem.
--
-- 2. DADOS DA EMPRESA E CHAVES PIX
-- O cliente ja trocou o CNPJ uma vez (BAHIA HOJE -> REDE BRASIL HOJE) e pediu
-- "tudo editavel no painel admin pra eu trocar depois". Entao razao social,
-- CNPJ e chaves PIX viram cadastro, nao codigo. Trocar de novo passa a ser um
-- campo no painel, nao uma nova versao do aplicativo.
--
-- ATENCAO: isto guarda e exibe dados para pagamento manual. Nao movimenta
-- dinheiro, nao confere comprovante e nao integra banco nenhum.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Forma de pagamento na corrida
-- ---------------------------------------------------------------------------
alter table public.corridas
  add column if not exists forma_pagamento text not null default 'carteira'
    check (forma_pagamento in ('carteira', 'dinheiro')),
  add column if not exists valor_pago_centavos bigint,
  add column if not exists troco_centavos bigint;

comment on column public.corridas.valor_pago_centavos is
  'Somente para dinheiro: com quanto o passageiro disse que vai pagar.';
comment on column public.corridas.troco_centavos is
  'Somente para dinheiro: valor_pago - valor da corrida. Calculado no servidor.';

-- ---------------------------------------------------------------------------
-- Dados da empresa (editaveis pelo Admin)
-- ---------------------------------------------------------------------------
insert into public.configuracoes (chave, valor, descricao) values
  ('empresa_razao_social', 'REDE BRASIL HOJE LTDA',
   'Razao social que aparece no painel e nos dados de pagamento.'),
  ('empresa_cnpj', '62.142.941/0001-17',
   'CNPJ da empresa que recebe a taxa.')
on conflict (chave) do nothing;

-- ---------------------------------------------------------------------------
-- Contas de recebimento (chaves PIX)
-- ---------------------------------------------------------------------------
create table if not exists public.contas_recebimento (
  id            uuid primary key default gen_random_uuid(),
  banco         text        not null,
  tipo_chave    text        not null check (tipo_chave in ('cnpj', 'cpf', 'celular', 'email', 'aleatoria')),
  chave         text        not null,
  titular       text        not null default '',
  ativa         boolean     not null default true,
  ordem         smallint    not null default 0,
  atualizado_em timestamptz not null default now()
);

comment on table public.contas_recebimento is
  'Chaves PIX da empresa, exibidas para pagamento manual. Nao ha integracao bancaria.';

alter table public.contas_recebimento enable row level security;

-- Passageiro precisa ver a chave para poder pagar; so as ativas.
drop policy if exists contas_leitura on public.contas_recebimento;
create policy contas_leitura on public.contas_recebimento
  for select to authenticated using (ativa);

drop policy if exists contas_admin on public.contas_recebimento;
create policy contas_admin on public.contas_recebimento
  for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

insert into public.contas_recebimento (banco, tipo_chave, chave, titular, ordem)
select 'BTG Pactual', 'cnpj', '62142941000117', 'REDE BRASIL HOJE LTDA', 1
 where not exists (select 1 from public.contas_recebimento);

insert into public.contas_recebimento (banco, tipo_chave, chave, titular, ordem)
select 'Nubank', 'celular', '75991328440', 'Alberto Luiz dos Santos', 2
 where not exists (select 1 from public.contas_recebimento where banco = 'Nubank');

-- ---------------------------------------------------------------------------
-- Criar corrida: aceita forma de pagamento e calcula o troco
-- ---------------------------------------------------------------------------
create or replace function public.criar_corrida(
  p_categoria_chave text,
  p_destino_texto text,
  p_origem_texto text default '',
  p_origem_lat numeric default null,
  p_origem_lng numeric default null,
  p_destino_lat numeric default null,
  p_destino_lng numeric default null,
  p_cidade_id uuid default null,
  p_forma_pagamento text default 'carteira',
  p_valor_pago_centavos bigint default null
)
returns public.corridas
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
  v_cat public.categorias;
  v_saldo bigint;
  v_estimado bigint;
  v_corrida public.corridas;
  v_km numeric;
  v_fator numeric := public.config_num('fator_rota', 1.3);
  v_min numeric := public.config_num('distancia_minima_km', 1);
  v_taxa numeric := public.taxa_empresa_vigente();
  v_forma text := lower(coalesce(p_forma_pagamento, 'carteira'));
  v_troco bigint;
begin
  if v_uid is null then
    raise exception 'Sessao expirada. Entre novamente.';
  end if;

  if v_forma not in ('carteira', 'dinheiro') then
    raise exception 'Forma de pagamento invalida.';
  end if;

  if coalesce(trim(p_destino_texto), '') = '' then
    raise exception 'Informe o destino.';
  end if;

  select * into v_cat from public.categorias
   where chave = p_categoria_chave and ativo;

  if v_cat is null then
    raise exception 'Categoria indisponivel.';
  end if;

  if exists (
    select 1 from public.corridas
     where passageiro_id = v_uid and status = 'aberta'
  ) then
    raise exception 'Voce ja tem uma chamada em andamento.';
  end if;

  v_km := public.distancia_km(p_origem_lat, p_origem_lng, p_destino_lat, p_destino_lng);
  v_km := coalesce(v_km, 0) * v_fator;
  v_km := greatest(round(v_km, 2), v_min);

  v_estimado := v_cat.tarifa_base_centavos
              + round(v_cat.preco_km_centavos * v_km)::bigint;

  if v_forma = 'carteira' then
    -- Na carteira o saldo tem de cobrir a corrida antes de ela comecar.
    select saldo_centavos into v_saldo
      from public.carteiras where passageiro_id = v_uid;

    if v_saldo is null then
      raise exception 'Carteira nao encontrada.';
    end if;

    if v_saldo < v_estimado then
      raise exception 'Saldo insuficiente na carteira para esta chamada.';
    end if;
  else
    -- Em dinheiro nao ha saldo a conferir, mas o troco tem de fechar.
    if p_valor_pago_centavos is not null then
      if p_valor_pago_centavos < v_estimado then
        raise exception 'O valor informado e menor que o da corrida.';
      end if;
      v_troco := p_valor_pago_centavos - v_estimado;
    end if;
  end if;

  insert into public.corridas (
    passageiro_id, categoria_chave, origem_texto, destino_texto,
    distancia_km, valor_estimado_centavos, passo_atual, status,
    origem_lat, origem_lng, destino_lat, destino_lng,
    cidade_id, taxa_empresa_percentual, distancia_aproximada,
    forma_pagamento, valor_pago_centavos, troco_centavos
  )
  values (
    v_uid, v_cat.chave, coalesce(p_origem_texto, ''), trim(p_destino_texto),
    v_km, v_estimado, 1, 'aberta',
    p_origem_lat, p_origem_lng, p_destino_lat, p_destino_lng,
    p_cidade_id, v_taxa, true,
    v_forma,
    case when v_forma = 'dinheiro' then p_valor_pago_centavos end,
    v_troco
  )
  returning * into v_corrida;

  insert into public.corrida_eventos (corrida_id, passo, chave)
  values (v_corrida.id, 1, 'chamada_enviada');

  return v_corrida;
end;
$fn$;

-- A assinatura mudou; a antiga sai para nao ficar ambigua no PostgREST.
drop function if exists public.criar_corrida(text, text, text, numeric, numeric, numeric, numeric, uuid);

revoke all on function public.criar_corrida(text, text, text, numeric, numeric, numeric, numeric, uuid, text, bigint) from public, anon;
grant execute on function public.criar_corrida(text, text, text, numeric, numeric, numeric, numeric, uuid, text, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Conclusao: so debita carteira quando o pagamento e pela carteira
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

  -- Passo 5.
  if v_corrida.forma_pagamento = 'carteira' then
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
  end if;
  -- Em dinheiro nao ha lancamento na carteira: o passageiro paga na mao do
  -- motorista. O rateio abaixo continua valendo para o painel saber quanto a
  -- empresa tem a receber dele.

  v_taxa := coalesce(v_corrida.taxa_empresa_percentual, public.taxa_empresa_vigente());
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
