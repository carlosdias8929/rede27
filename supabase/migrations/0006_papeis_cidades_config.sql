-- ===========================================================================
-- REDE27 — Opcao B: papeis, cidades e configuracao
--
-- A Fase 1 passou a ter tres frentes (app do passageiro, painel do motorista e
-- painel Admin), entao os papeis deixam de ser "passageiro ou operador":
--
--   passageiro     -> public.passageiros   (ja existia)
--   motorista      -> public.motoristas    (novo, com as fotos obrigatorias)
--   administrador  -> public.administradores (era public.operadores)
--
-- A tabela `operadores` vira `administradores` porque agora existe motorista de
-- verdade e "operador" ficaria ambiguo.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Cidades — cadastro ilimitado, confirmado por escrito ao cliente
-- ---------------------------------------------------------------------------
create table if not exists public.cidades (
  id        uuid primary key default gen_random_uuid(),
  nome      text        not null,
  uf        char(2)     not null default 'BA',
  ativa     boolean     not null default true,
  criada_em timestamptz not null default now(),
  unique (nome, uf)
);

comment on table public.cidades is
  'Cidades atendidas. Sem limite de quantidade: e cadastro, nao configuracao paga.';

insert into public.cidades (nome, uf) values
  ('Feira de Santana', 'BA'),
  ('Riachao do Jacuipe', 'BA')
on conflict (nome, uf) do nothing;

-- ---------------------------------------------------------------------------
-- Configuracoes editaveis pelo Admin (chave/valor)
-- ---------------------------------------------------------------------------
create table if not exists public.configuracoes (
  chave         text primary key,
  valor         text        not null,
  descricao     text        not null default '',
  atualizado_em timestamptz not null default now()
);

insert into public.configuracoes (chave, valor, descricao) values
  ('taxa_empresa_percentual', '25',
   'Percentual da corrida que fica com a REDE27. O restante e do motorista.'),
  ('fator_rota', '1.3',
   'Multiplicador sobre a distancia em linha reta para aproximar a distancia por rua. Provisorio, ate entrar API de mapas.'),
  ('distancia_minima_km', '1',
   'Distancia minima cobrada em uma corrida.')
on conflict (chave) do nothing;

/** Le uma configuracao numerica, com valor padrao se ausente ou invalida. */
create or replace function public.config_num(p_chave text, p_padrao numeric)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select coalesce(
    (select nullif(regexp_replace(valor, '[^0-9.\-]', '', 'g'), '')::numeric
       from public.configuracoes where chave = p_chave),
    p_padrao
  );
$fn$;

-- ---------------------------------------------------------------------------
-- Operadores -> Administradores
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'operadores')
     and not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'administradores')
  then
    alter table public.operadores rename to administradores;
  end if;
end;
$$;

create table if not exists public.administradores (
  id        uuid primary key references auth.users (id) on delete cascade,
  nome      text        not null default '',
  ativo     boolean     not null default true,
  criado_em timestamptz not null default now()
);

comment on table public.administradores is
  'Contas do painel Admin. Cadastro manual: ninguem se promove sozinho.';

alter table public.administradores enable row level security;

drop policy if exists operadores_proprio_select on public.administradores;
drop policy if exists administradores_proprio_select on public.administradores;
create policy administradores_proprio_select on public.administradores
  for select to authenticated using (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Motoristas
-- ---------------------------------------------------------------------------
create table if not exists public.motoristas (
  id                uuid primary key references auth.users (id) on delete cascade,
  nome              text        not null default '',
  cpf               char(11)    not null unique,
  telefone          text        not null default '',
  foto_perfil_url   text,
  foto_veiculo_url  text,
  veiculo_descricao text        not null default '',
  veiculo_placa     text        not null default '',
  cidade_id         uuid references public.cidades (id) on delete set null,
  ativo             boolean     not null default true,
  criado_em         timestamptz not null default now(),

  -- O cliente exigiu as duas fotos na Fase 1. Em vez de confiar na tela, o
  -- proprio banco calcula se o cadastro esta completo, e `aceitar_corrida`
  -- recusa quem nao estiver.
  cadastro_completo boolean generated always as (
    foto_perfil_url is not null and length(trim(foto_perfil_url)) > 0
    and foto_veiculo_url is not null and length(trim(foto_veiculo_url)) > 0
    and length(trim(nome)) > 0
    and length(trim(telefone)) > 0
  ) stored
);

comment on column public.motoristas.cadastro_completo is
  'Calculado pelo banco: sem as duas fotos, nome e telefone o motorista nao aceita corrida.';

alter table public.motoristas enable row level security;

-- ---------------------------------------------------------------------------
-- Quem e quem
-- ---------------------------------------------------------------------------
create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.administradores where id = auth.uid() and ativo
  );
$fn$;

create or replace function public.eh_motorista()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.motoristas where id = auth.uid() and ativo
  );
$fn$;

revoke all on function public.eh_admin() from public, anon;
revoke all on function public.eh_motorista() from public, anon;
grant execute on function public.eh_admin() to authenticated;
grant execute on function public.eh_motorista() to authenticated;

revoke all on function public.config_num(text, numeric) from public, anon;
grant execute on function public.config_num(text, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- Politicas
-- ---------------------------------------------------------------------------

-- Motorista le e edita o proprio cadastro (inclusive as fotos).
drop policy if exists motoristas_proprio_select on public.motoristas;
create policy motoristas_proprio_select on public.motoristas
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists motoristas_proprio_update on public.motoristas;
create policy motoristas_proprio_update on public.motoristas
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Admin ve e administra todos os motoristas.
drop policy if exists motoristas_admin_select on public.motoristas;
create policy motoristas_admin_select on public.motoristas
  for select to authenticated using (public.eh_admin());

drop policy if exists motoristas_admin_update on public.motoristas;
create policy motoristas_admin_update on public.motoristas
  for update to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- Cidades: leitura para qualquer autenticado, escrita so para o Admin.
alter table public.cidades enable row level security;

drop policy if exists cidades_leitura on public.cidades;
create policy cidades_leitura on public.cidades
  for select to anon, authenticated using (true);

drop policy if exists cidades_admin_escreve on public.cidades;
create policy cidades_admin_escreve on public.cidades
  for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- Configuracoes: leitura autenticada, escrita so Admin.
alter table public.configuracoes enable row level security;

drop policy if exists configuracoes_leitura on public.configuracoes;
create policy configuracoes_leitura on public.configuracoes
  for select to authenticated using (true);

drop policy if exists configuracoes_admin_escreve on public.configuracoes;
create policy configuracoes_admin_escreve on public.configuracoes
  for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- Precos: o Admin passa a editar pela interface, nao mais so por SQL.
drop policy if exists categorias_admin_escreve on public.categorias;
create policy categorias_admin_escreve on public.categorias
  for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- ---------------------------------------------------------------------------
-- Politicas de corridas passam a usar eh_admin()
-- ---------------------------------------------------------------------------
drop policy if exists corridas_operador_select on public.corridas;
drop policy if exists corrida_eventos_operador_select on public.corrida_eventos;

drop policy if exists corridas_admin_select on public.corridas;
create policy corridas_admin_select on public.corridas
  for select to authenticated using (public.eh_admin());

drop policy if exists corrida_eventos_admin_select on public.corrida_eventos;
create policy corrida_eventos_admin_select on public.corrida_eventos
  for select to authenticated using (public.eh_admin());

-- `eh_operador()` continua viva de proposito: `avancar_protocolo` ainda a chama.
-- Ela so e removida na 0007, depois que a funcao for reescrita.
