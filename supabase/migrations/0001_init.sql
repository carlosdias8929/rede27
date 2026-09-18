-- ===========================================================================
-- REDE27 — esquema inicial (MVP)
-- Transporte de passageiros, bens e encomendas.
--
-- Principio de seguranca: o saldo da carteira NUNCA e escrito pelo aplicativo.
-- Toda movimentacao passa pelas funcoes SECURITY DEFINER no fim do arquivo.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Categorias de servico (com ar / sem ar / transporte de bens)
-- Precos editaveis pelo cliente sem republicar o aplicativo.
-- ---------------------------------------------------------------------------
create table if not exists public.categorias (
  chave                  text primary key,
  nome                   text        not null,
  descricao              text        not null default '',
  tarifa_base_centavos   integer     not null check (tarifa_base_centavos >= 0),
  preco_km_centavos      integer     not null check (preco_km_centavos >= 0),
  ordem                  smallint    not null default 0,
  ativo                  boolean     not null default true,
  atualizado_em          timestamptz not null default now()
);

comment on table public.categorias is
  'Categorias de servico com tarifa propria. Valores em centavos para evitar erro de arredondamento.';

-- ---------------------------------------------------------------------------
-- Passageiros (perfil ligado ao usuario autenticado)
-- ---------------------------------------------------------------------------
create table if not exists public.passageiros (
  id          uuid primary key references auth.users (id) on delete cascade,
  cpf         char(11)    not null unique,
  nome        text        not null default '',
  telefone    text        not null default '',
  criado_em   timestamptz not null default now()
);

comment on column public.passageiros.cpf is
  'Somente digitos, sem mascara. Unico: um CPF = um cadastro.';

-- ---------------------------------------------------------------------------
-- Carteira
-- ---------------------------------------------------------------------------
create table if not exists public.carteiras (
  id             uuid primary key default gen_random_uuid(),
  passageiro_id  uuid        not null unique references public.passageiros (id) on delete cascade,
  saldo_centavos bigint      not null default 0 check (saldo_centavos >= 0),
  atualizado_em  timestamptz not null default now()
);

create table if not exists public.transacoes (
  id             uuid primary key default gen_random_uuid(),
  carteira_id    uuid        not null references public.carteiras (id) on delete cascade,
  tipo           text        not null check (tipo in ('credito', 'debito')),
  valor_centavos bigint      not null check (valor_centavos > 0),
  descricao      text        not null default '',
  corrida_id     uuid,
  criado_em      timestamptz not null default now()
);

create index if not exists transacoes_carteira_idx
  on public.transacoes (carteira_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- Corridas e o protocolo de 5 passos
-- ---------------------------------------------------------------------------
create table if not exists public.corridas (
  id                      uuid primary key default gen_random_uuid(),
  passageiro_id           uuid         not null references public.passageiros (id) on delete cascade,
  categoria_chave         text         not null references public.categorias (chave),
  origem_texto            text         not null default '',
  destino_texto           text         not null,
  distancia_km            numeric(6,2) not null default 0,
  valor_estimado_centavos bigint       not null default 0,
  valor_final_centavos    bigint,
  -- Passo do protocolo: 1..5. A tela 3 le exatamente este campo.
  passo_atual             smallint     not null default 1 check (passo_atual between 1 and 5),
  status                  text         not null default 'aberta'
                                       check (status in ('aberta', 'concluida', 'cancelada')),
  motorista_nome          text,
  criada_em               timestamptz  not null default now(),
  atualizada_em           timestamptz  not null default now()
);

create index if not exists corridas_passageiro_idx
  on public.corridas (passageiro_id, criada_em desc);

-- Fila do painel do motorista: chamadas abertas ainda no passo 1.
create index if not exists corridas_abertas_idx
  on public.corridas (status, passo_atual, criada_em)
  where status = 'aberta';

-- Historico auditavel de cada passo do protocolo.
create table if not exists public.corrida_eventos (
  id           uuid primary key default gen_random_uuid(),
  corrida_id   uuid        not null references public.corridas (id) on delete cascade,
  passo        smallint    not null check (passo between 1 and 5),
  chave        text        not null,
  observacao   text        not null default '',
  criado_em    timestamptz not null default now()
);

create index if not exists corrida_eventos_corrida_idx
  on public.corrida_eventos (corrida_id, passo);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.categorias       enable row level security;
alter table public.passageiros      enable row level security;
alter table public.carteiras        enable row level security;
alter table public.transacoes       enable row level security;
alter table public.corridas         enable row level security;
alter table public.corrida_eventos  enable row level security;

-- Categorias: leitura publica (a tela de chamada precisa dos precos).
drop policy if exists categorias_leitura on public.categorias;
create policy categorias_leitura on public.categorias
  for select to anon, authenticated using (ativo);

-- Passageiro le e atualiza apenas o proprio cadastro.
drop policy if exists passageiros_proprio_select on public.passageiros;
create policy passageiros_proprio_select on public.passageiros
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists passageiros_proprio_update on public.passageiros;
create policy passageiros_proprio_update on public.passageiros
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Carteira: somente leitura pelo dono. Escrita so pelas funcoes do servidor.
drop policy if exists carteiras_proprio_select on public.carteiras;
create policy carteiras_proprio_select on public.carteiras
  for select to authenticated using (passageiro_id = (select auth.uid()));

-- Extrato: somente leitura pelo dono da carteira.
drop policy if exists transacoes_proprio_select on public.transacoes;
create policy transacoes_proprio_select on public.transacoes
  for select to authenticated using (
    exists (
      select 1 from public.carteiras c
      where c.id = transacoes.carteira_id
        and c.passageiro_id = (select auth.uid())
    )
  );

-- Corridas: o passageiro le as proprias. Criacao e avanco passam por RPC.
drop policy if exists corridas_proprio_select on public.corridas;
create policy corridas_proprio_select on public.corridas
  for select to authenticated using (passageiro_id = (select auth.uid()));

drop policy if exists corrida_eventos_proprio_select on public.corrida_eventos;
create policy corrida_eventos_proprio_select on public.corrida_eventos
  for select to authenticated using (
    exists (
      select 1 from public.corridas r
      where r.id = corrida_eventos.corrida_id
        and r.passageiro_id = (select auth.uid())
    )
  );

-- ===========================================================================
-- Cadastro automatico: todo usuario novo ganha perfil + carteira
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_cpf char(11);
begin
  -- O CPF chega nos metadados enviados no cadastro.
  v_cpf := regexp_replace(coalesce(new.raw_user_meta_data ->> 'cpf', ''), '[^0-9]', '', 'g');

  if length(v_cpf) <> 11 then
    raise exception 'CPF ausente ou invalido no cadastro';
  end if;

  insert into public.passageiros (id, cpf, nome, telefone)
  values (
    new.id,
    v_cpf,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    coalesce(new.raw_user_meta_data ->> 'telefone', '')
  );

  insert into public.carteiras (passageiro_id, saldo_centavos)
  values (new.id, 0);

  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- Movimentacao de carteira — unico caminho de escrita do saldo
-- ===========================================================================
create or replace function public.creditar_carteira(
  p_passageiro_id uuid,
  p_valor_centavos bigint,
  p_descricao text default 'Recarga'
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_carteira_id uuid;
  v_saldo bigint;
begin
  if p_valor_centavos <= 0 then
    raise exception 'Valor de credito deve ser positivo';
  end if;

  -- Trava a linha para evitar corrida entre dois creditos simultaneos.
  select id into v_carteira_id
    from public.carteiras
   where passageiro_id = p_passageiro_id
     for update;

  if v_carteira_id is null then
    raise exception 'Carteira nao encontrada';
  end if;

  update public.carteiras
     set saldo_centavos = saldo_centavos + p_valor_centavos,
         atualizado_em = now()
   where id = v_carteira_id
  returning saldo_centavos into v_saldo;

  insert into public.transacoes (carteira_id, tipo, valor_centavos, descricao)
  values (v_carteira_id, 'credito', p_valor_centavos, p_descricao);

  return v_saldo;
end;
$fn$;

-- Credito e operacao administrativa: nao exposta ao aplicativo do passageiro.
revoke all on function public.creditar_carteira(uuid, bigint, text) from public;
revoke all on function public.creditar_carteira(uuid, bigint, text) from anon;
revoke all on function public.creditar_carteira(uuid, bigint, text) from authenticated;

-- ===========================================================================
-- Criar chamada (tela 2) — preco calculado no servidor
-- ===========================================================================
create or replace function public.criar_corrida(
  p_categoria_chave text,
  p_destino_texto text,
  p_origem_texto text default '',
  p_distancia_km numeric default 3.0
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
begin
  if v_uid is null then
    raise exception 'Sessao expirada. Entre novamente.';
  end if;

  if coalesce(trim(p_destino_texto), '') = '' then
    raise exception 'Informe o destino.';
  end if;

  if p_distancia_km is null or p_distancia_km <= 0 then
    p_distancia_km := 3.0;
  end if;

  select * into v_cat from public.categorias
   where chave = p_categoria_chave and ativo;

  if v_cat is null then
    raise exception 'Categoria indisponivel.';
  end if;

  -- Uma chamada aberta por vez.
  if exists (
    select 1 from public.corridas
     where passageiro_id = v_uid and status = 'aberta'
  ) then
    raise exception 'Voce ja tem uma chamada em andamento.';
  end if;

  v_estimado := v_cat.tarifa_base_centavos
              + round(v_cat.preco_km_centavos * p_distancia_km)::bigint;

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
    distancia_km, valor_estimado_centavos, passo_atual, status
  )
  values (
    v_uid, v_cat.chave, coalesce(p_origem_texto, ''), trim(p_destino_texto),
    p_distancia_km, v_estimado, 1, 'aberta'
  )
  returning * into v_corrida;

  insert into public.corrida_eventos (corrida_id, passo, chave)
  values (v_corrida.id, 1, 'chamada_enviada');

  return v_corrida;
end;
$fn$;

grant execute on function public.criar_corrida(text, text, text, numeric) to authenticated;

-- ===========================================================================
-- Avancar o protocolo (passo N -> N+1). No passo 5 debita a carteira.
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
  v_corrida public.corridas;
  v_carteira_id uuid;
  v_saldo bigint;
  v_proximo smallint;
begin
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

-- ===========================================================================
-- Cancelar chamada (passageiro, antes do embarque)
-- ===========================================================================
create or replace function public.cancelar_corrida(p_corrida_id uuid)
returns public.corridas
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
  v_corrida public.corridas;
begin
  select * into v_corrida from public.corridas
   where id = p_corrida_id and passageiro_id = v_uid
     for update;

  if v_corrida is null then
    raise exception 'Chamada nao encontrada.';
  end if;

  if v_corrida.status <> 'aberta' then
    raise exception 'Esta chamada ja foi encerrada.';
  end if;

  update public.corridas
     set status = 'cancelada', atualizada_em = now()
   where id = p_corrida_id
  returning * into v_corrida;

  insert into public.corrida_eventos (corrida_id, passo, chave, observacao)
  values (v_corrida.id, v_corrida.passo_atual, 'cancelada', 'Cancelada pelo passageiro');

  return v_corrida;
end;
$fn$;

grant execute on function public.cancelar_corrida(uuid) to authenticated;

-- ===========================================================================
-- Precos iniciais (exemplo — o cliente ajusta na tabela, sem rebuild)
-- ===========================================================================
insert into public.categorias (chave, nome, descricao, tarifa_base_centavos, preco_km_centavos, ordem)
values
  ('com_ar',          'Com ar',              'Carro de passeio com ar-condicionado.',                        800, 240, 1),
  ('sem_ar',          'Sem ar',              'Carro de passeio sem ar-condicionado. Tarifa reduzida.',       600, 190, 2),
  ('transporte_bens', 'Transporte de Bens',  'Envelopes e caixas pequenas. Preparado para veiculo proprio.', 700, 210, 3)
on conflict (chave) do nothing;
