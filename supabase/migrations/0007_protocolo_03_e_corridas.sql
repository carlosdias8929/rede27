-- ===========================================================================
-- REDE27 — Opcao B: Protocolo 03 (botao de panico) e corridas com motorista
--
-- ATENCAO A UMA MUDANCA DE SIGNIFICADO
-- Na primeira versao, "protocolo de 5 passos" era o fluxo da corrida e a
-- "trava 03" era um travamento do botao CHAMAR. O cliente esclareceu em 18/09
-- que nao e isso:
--
--   O 03 e um BOTAO DE PANICO. O passageiro segura 3 segundos e dispara um
--   alerta com a localizacao no painel Admin. Os cinco passos sao os desse
--   alerta, nao os da corrida.
--
-- Entao aqui existem DOIS fluxos distintos:
--   public.corridas     -> ciclo de vida da corrida (passo_atual 1..5)
--   public.alertas_03   -> protocolo de emergencia   (passo_atual 1..5)
--
-- Regra de seguranca combinada com o cliente: o alerta e SILENCIOSO para o
-- motorista e so toca no Admin. Se o passageiro acionou por causa do motorista,
-- um som no celular dele avisaria exatamente quem representa o risco.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Distancia em linha reta (Haversine), em quilometros.
-- Provisorio e assumido como tal: o cliente aceitou "mapa gratuito provisorio".
-- Quando entrar uma API de rotas, e esta funcao que sai.
-- ---------------------------------------------------------------------------
create or replace function public.distancia_km(
  p_lat1 numeric, p_lng1 numeric, p_lat2 numeric, p_lng2 numeric
)
returns numeric
language sql
immutable
as $fn$
  select case
    when p_lat1 is null or p_lng1 is null or p_lat2 is null or p_lng2 is null then null
    else round(
      (6371 * 2 * asin(sqrt(
        power(sin(radians(p_lat2 - p_lat1) / 2), 2) +
        cos(radians(p_lat1)) * cos(radians(p_lat2)) *
        power(sin(radians(p_lng2 - p_lng1) / 2), 2)
      )))::numeric, 3)
  end;
$fn$;

-- ---------------------------------------------------------------------------
-- Corridas ganham motorista, cidade, coordenadas e o rateio da taxa
-- ---------------------------------------------------------------------------
alter table public.corridas
  add column if not exists motorista_id uuid references public.motoristas (id) on delete set null,
  add column if not exists cidade_id uuid references public.cidades (id) on delete set null,
  add column if not exists origem_lat numeric(10,7),
  add column if not exists origem_lng numeric(10,7),
  add column if not exists destino_lat numeric(10,7),
  add column if not exists destino_lng numeric(10,7),
  add column if not exists distancia_aproximada boolean not null default true,
  add column if not exists taxa_empresa_percentual numeric(5,2),
  add column if not exists valor_motorista_centavos bigint,
  add column if not exists valor_empresa_centavos bigint;

comment on column public.corridas.distancia_aproximada is
  'true = distancia estimada em linha reta com fator de rota. Vira false quando entrar API de rotas.';

create index if not exists corridas_motorista_idx
  on public.corridas (motorista_id, criada_em desc);

-- ---------------------------------------------------------------------------
-- O passageiro precisa ver a foto e o nome do motorista da corrida dele.
-- Funcao SECURITY DEFINER porque a expressao de policy roda com os direitos de
-- quem consulta, e o passageiro nao enxerga a tabela de corridas de terceiros.
-- ---------------------------------------------------------------------------
create or replace function public.motorista_atende_meu_chamado(p_motorista_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.corridas c
     where c.motorista_id = p_motorista_id
       and c.passageiro_id = auth.uid()
  );
$fn$;

revoke all on function public.motorista_atende_meu_chamado(uuid) from public, anon;
grant execute on function public.motorista_atende_meu_chamado(uuid) to authenticated;

drop policy if exists motoristas_passageiro_select on public.motoristas;
create policy motoristas_passageiro_select on public.motoristas
  for select to authenticated
  using (public.motorista_atende_meu_chamado(id));

-- ---------------------------------------------------------------------------
-- Alertas do Protocolo 03
-- ---------------------------------------------------------------------------
create table if not exists public.alertas_03 (
  id             uuid primary key default gen_random_uuid(),
  passageiro_id  uuid        not null references public.passageiros (id) on delete cascade,
  corrida_id     uuid references public.corridas (id) on delete set null,
  motorista_id   uuid references public.motoristas (id) on delete set null,

  latitude       numeric(10,7),
  longitude      numeric(10,7),
  precisao_m     numeric(8,2),

  -- 1 acionado | 2 localizacao enviada | 3 exibido no Admin
  -- 4 contato realizado | 5 encerrado
  passo_atual    smallint    not null default 1 check (passo_atual between 1 and 5),
  status         text        not null default 'ativo' check (status in ('ativo', 'encerrado')),

  acionado_em    timestamptz not null default now(),
  encerrado_em   timestamptz,
  encerrado_por  uuid references auth.users (id) on delete set null,
  observacao     text        not null default ''
);

comment on table public.alertas_03 is
  'Acionamentos do botao de panico 03. Silencioso para o motorista; alarme apenas no painel Admin.';

create index if not exists alertas_03_ativos_idx
  on public.alertas_03 (status, acionado_em desc) where status = 'ativo';

create table if not exists public.alerta_03_eventos (
  id         uuid primary key default gen_random_uuid(),
  alerta_id  uuid        not null references public.alertas_03 (id) on delete cascade,
  passo      smallint    not null check (passo between 1 and 5),
  chave      text        not null,
  detalhe    text        not null default '',
  criado_por uuid references auth.users (id) on delete set null,
  criado_em  timestamptz not null default now()
);

alter table public.alertas_03 enable row level security;
alter table public.alerta_03_eventos enable row level security;

-- O passageiro ve os proprios acionamentos; o Admin ve todos.
drop policy if exists alertas_03_proprio_select on public.alertas_03;
create policy alertas_03_proprio_select on public.alertas_03
  for select to authenticated using (passageiro_id = (select auth.uid()));

drop policy if exists alertas_03_admin_select on public.alertas_03;
create policy alertas_03_admin_select on public.alertas_03
  for select to authenticated using (public.eh_admin());

-- Motorista NAO le esta tabela: o alerta e silencioso para ele.

drop policy if exists alerta_03_eventos_admin_select on public.alerta_03_eventos;
create policy alerta_03_eventos_admin_select on public.alerta_03_eventos
  for select to authenticated using (public.eh_admin());

-- ---------------------------------------------------------------------------
-- Passos 1 e 2: o passageiro aciona e o app manda a localizacao
-- ---------------------------------------------------------------------------
create or replace function public.acionar_03(
  p_corrida_id uuid default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_precisao_m numeric default null
)
returns public.alertas_03
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
  v_corrida public.corridas;
  v_alerta public.alertas_03;
  v_tem_local boolean := p_latitude is not null and p_longitude is not null;
begin
  if v_uid is null then
    raise exception 'Sessao expirada. Entre novamente.';
  end if;

  if not exists (select 1 from public.passageiros where id = v_uid) then
    raise exception 'Apenas passageiros acionam o protocolo 03.';
  end if;

  -- Um alerta ativo por vez: segurar o botao de novo nao gera duplicata.
  select * into v_alerta from public.alertas_03
   where passageiro_id = v_uid and status = 'ativo'
   order by acionado_em desc limit 1;

  if v_alerta.id is not null then
    -- Ja existe: so atualiza a localizacao, que pode ter melhorado.
    if v_tem_local then
      update public.alertas_03
         set latitude = p_latitude,
             longitude = p_longitude,
             precisao_m = p_precisao_m,
             passo_atual = greatest(passo_atual, 2)
       where id = v_alerta.id
      returning * into v_alerta;

      insert into public.alerta_03_eventos (alerta_id, passo, chave, detalhe, criado_por)
      values (v_alerta.id, 2, 'localizacao_atualizada', 'Nova leitura de GPS', v_uid);
    end if;
    return v_alerta;
  end if;

  if p_corrida_id is not null then
    select * into v_corrida from public.corridas
     where id = p_corrida_id and passageiro_id = v_uid;
  end if;

  insert into public.alertas_03 (
    passageiro_id, corrida_id, motorista_id,
    latitude, longitude, precisao_m, passo_atual
  )
  values (
    v_uid, v_corrida.id, v_corrida.motorista_id,
    p_latitude, p_longitude, p_precisao_m,
    -- Sem GPS o alerta nasce no passo 1 e espera a localizacao chegar.
    case when v_tem_local then 2 else 1 end
  )
  returning * into v_alerta;

  insert into public.alerta_03_eventos (alerta_id, passo, chave, detalhe, criado_por)
  values (v_alerta.id, 1, 'acionado', 'Passageiro segurou o 03 por 3 segundos', v_uid);

  if v_tem_local then
    insert into public.alerta_03_eventos (alerta_id, passo, chave, detalhe, criado_por)
    values (v_alerta.id, 2, 'localizacao_enviada', 'Localizacao e dados da corrida enviados ao Admin', v_uid);
  end if;

  return v_alerta;
end;
$fn$;

revoke all on function public.acionar_03(uuid, numeric, numeric, numeric) from public, anon;
grant execute on function public.acionar_03(uuid, numeric, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- Passos 3, 4 e 5: o Admin recebe, liga e encerra
-- ---------------------------------------------------------------------------
create or replace function public.registrar_passo_03(
  p_alerta_id uuid,
  p_passo smallint,
  p_chave text,
  p_detalhe text default ''
)
returns public.alertas_03
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_alerta public.alertas_03;
begin
  if not public.eh_admin() then
    raise exception 'Apenas o painel Admin movimenta o protocolo 03.';
  end if;

  if p_passo not between 3 and 4 then
    raise exception 'Use encerrar_03 para o passo 5.';
  end if;

  select * into v_alerta from public.alertas_03 where id = p_alerta_id for update;

  if v_alerta.id is null then
    raise exception 'Alerta nao encontrado.';
  end if;

  if v_alerta.status <> 'ativo' then
    raise exception 'Este alerta ja foi encerrado.';
  end if;

  -- O passo nunca anda para tras: ver de novo um alerta ja contatado nao o
  -- rebaixa do passo 4 para o 3.
  update public.alertas_03
     set passo_atual = greatest(passo_atual, p_passo)
   where id = p_alerta_id
  returning * into v_alerta;

  insert into public.alerta_03_eventos (alerta_id, passo, chave, detalhe, criado_por)
  values (p_alerta_id, p_passo, p_chave, coalesce(p_detalhe, ''), auth.uid());

  return v_alerta;
end;
$fn$;

revoke all on function public.registrar_passo_03(uuid, smallint, text, text) from public, anon;
grant execute on function public.registrar_passo_03(uuid, smallint, text, text) to authenticated;

create or replace function public.encerrar_03(
  p_alerta_id uuid,
  p_observacao text default ''
)
returns public.alertas_03
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_alerta public.alertas_03;
begin
  if not public.eh_admin() then
    raise exception 'Apenas o painel Admin encerra o protocolo 03.';
  end if;

  select * into v_alerta from public.alertas_03 where id = p_alerta_id for update;

  if v_alerta.id is null then
    raise exception 'Alerta nao encontrado.';
  end if;

  if v_alerta.status <> 'ativo' then
    raise exception 'Este alerta ja foi encerrado.';
  end if;

  update public.alertas_03
     set status = 'encerrado',
         passo_atual = 5,
         encerrado_em = now(),
         encerrado_por = auth.uid(),
         observacao = coalesce(nullif(p_observacao, ''), observacao)
   where id = p_alerta_id
  returning * into v_alerta;

  insert into public.alerta_03_eventos (alerta_id, passo, chave, detalhe, criado_por)
  values (p_alerta_id, 5, 'encerrado', coalesce(p_observacao, ''), auth.uid());

  return v_alerta;
end;
$fn$;

revoke all on function public.encerrar_03(uuid, text) from public, anon;
grant execute on function public.encerrar_03(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Criar corrida: preco por km calculado no servidor
-- ---------------------------------------------------------------------------
drop function if exists public.criar_corrida(text, text, text, numeric);

create or replace function public.criar_corrida(
  p_categoria_chave text,
  p_destino_texto text,
  p_origem_texto text default '',
  p_origem_lat numeric default null,
  p_origem_lng numeric default null,
  p_destino_lat numeric default null,
  p_destino_lng numeric default null,
  p_cidade_id uuid default null
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
  v_taxa numeric := public.config_num('taxa_empresa_percentual', 25);
begin
  if v_uid is null then
    raise exception 'Sessao expirada. Entre novamente.';
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

  -- Distancia: linha reta corrigida por um fator, respeitando o minimo.
  v_km := public.distancia_km(p_origem_lat, p_origem_lng, p_destino_lat, p_destino_lng);
  v_km := coalesce(v_km, 0) * v_fator;
  v_km := greatest(round(v_km, 2), v_min);

  v_estimado := v_cat.tarifa_base_centavos
              + round(v_cat.preco_km_centavos * v_km)::bigint;

  select saldo_centavos into v_saldo
    from public.carteiras where passageiro_id = v_uid;

  if v_saldo is null then
    raise exception 'Carteira nao encontrada.';
  end if;

  if v_saldo < v_estimado then
    raise exception 'Saldo insuficiente na carteira para esta chamada.';
  end if;

  insert into public.corridas (
    passageiro_id, categoria_chave, origem_texto, destino_texto,
    distancia_km, valor_estimado_centavos, passo_atual, status,
    origem_lat, origem_lng, destino_lat, destino_lng,
    cidade_id, taxa_empresa_percentual, distancia_aproximada
  )
  values (
    v_uid, v_cat.chave, coalesce(p_origem_texto, ''), trim(p_destino_texto),
    v_km, v_estimado, 1, 'aberta',
    p_origem_lat, p_origem_lng, p_destino_lat, p_destino_lng,
    p_cidade_id, v_taxa, true
  )
  returning * into v_corrida;

  insert into public.corrida_eventos (corrida_id, passo, chave)
  values (v_corrida.id, 1, 'chamada_enviada');

  return v_corrida;
end;
$fn$;

revoke all on function public.criar_corrida(text, text, text, numeric, numeric, numeric, numeric, uuid) from public, anon;
grant execute on function public.criar_corrida(text, text, text, numeric, numeric, numeric, numeric, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Motorista aceita a corrida — exige cadastro completo (as duas fotos)
-- ---------------------------------------------------------------------------
create or replace function public.aceitar_corrida(p_corrida_id uuid)
returns public.corridas
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
  v_mot public.motoristas;
  v_corrida public.corridas;
begin
  select * into v_mot from public.motoristas where id = v_uid and ativo;

  if v_mot.id is null then
    raise exception 'Apenas motoristas ativos aceitam corridas.';
  end if;

  if not v_mot.cadastro_completo then
    raise exception 'Complete o cadastro (foto de perfil, foto do veiculo, nome e telefone) antes de aceitar corridas.';
  end if;

  select * into v_corrida from public.corridas where id = p_corrida_id for update;

  if v_corrida.id is null then
    raise exception 'Chamada nao encontrada.';
  end if;

  if v_corrida.status <> 'aberta' then
    raise exception 'Esta chamada ja foi encerrada.';
  end if;

  if v_corrida.motorista_id is not null then
    raise exception 'Outro motorista ja aceitou esta chamada.';
  end if;

  if v_corrida.passo_atual <> 1 then
    raise exception 'Esta chamada nao esta mais aguardando motorista.';
  end if;

  update public.corridas
     set motorista_id = v_mot.id,
         motorista_nome = v_mot.nome,
         passo_atual = 2,
         atualizada_em = now()
   where id = p_corrida_id
  returning * into v_corrida;

  insert into public.corrida_eventos (corrida_id, passo, chave)
  values (v_corrida.id, 2, 'motorista_aceitou');

  return v_corrida;
end;
$fn$;

revoke all on function public.aceitar_corrida(uuid) from public, anon;
grant execute on function public.aceitar_corrida(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Avancar o ciclo da corrida: motorista dono da corrida, ou Admin
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

  -- O motorista so mexe na corrida que aceitou. O Admin destrava qualquer uma.
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

    -- Rateio empresa/motorista. A taxa gravada na corrida manda: mudar o
    -- percentual no Admin nao pode reescrever o passado.
    v_taxa := coalesce(v_corrida.taxa_empresa_percentual,
                       public.config_num('taxa_empresa_percentual', 25));
    v_empresa := round(v_corrida.valor_estimado_centavos * v_taxa / 100.0)::bigint;

    update public.corridas
       set status = 'concluida',
           valor_final_centavos = v_corrida.valor_estimado_centavos,
           taxa_empresa_percentual = v_taxa,
           valor_empresa_centavos = v_empresa,
           valor_motorista_centavos = v_corrida.valor_estimado_centavos - v_empresa,
           atualizada_em = now()
     where id = p_corrida_id
    returning * into v_corrida;
  end if;

  return v_corrida;
end;
$fn$;

revoke all on function public.avancar_protocolo(uuid, text, text) from public, anon;
grant execute on function public.avancar_protocolo(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- O motorista precisa ver a fila e as proprias corridas
-- ---------------------------------------------------------------------------
drop policy if exists corridas_motorista_select on public.corridas;
create policy corridas_motorista_select on public.corridas
  for select to authenticated
  using (
    public.eh_motorista()
    and (motorista_id = (select auth.uid()) or motorista_id is null)
  );

drop policy if exists corrida_eventos_motorista_select on public.corrida_eventos;
create policy corrida_eventos_motorista_select on public.corrida_eventos
  for select to authenticated
  using (public.eh_motorista());

-- Agora nada mais depende dela.
drop function if exists public.eh_operador();
