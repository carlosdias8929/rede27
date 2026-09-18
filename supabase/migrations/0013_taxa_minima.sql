-- ===========================================================================
-- REDE27 / REDE BRASIL — piso de 25% na taxa da empresa
--
-- Exigencia do cliente, ao pe da letra: "25% fixo pra REDE BRASIL com retencao
-- automatica. Nao pode ser menos que 25% de jeito nenhum."
--
-- Validar isso so na tela do Admin nao serve: quem tiver a chave anon e uma
-- conta de administrador fala direto com a API e passa por cima do formulario.
-- Entao o piso vive no banco, em tres camadas:
--
--   1. gatilho em `configuracoes` — recusa gravar a taxa abaixo do piso;
--   2. `criar_corrida` — usa o maior entre a taxa configurada e o piso, para o
--      caso de uma linha antiga ter ficado abaixo;
--   3. `avancar_protocolo` — refaz a mesma checagem na hora de ratear.
--
-- O piso tambem e configuravel (`taxa_empresa_minima`), porque quem manda no
-- negocio e o cliente. Mas mexer nele e um ato deliberado e separado de mexer
-- na taxa do dia a dia.
-- ===========================================================================

insert into public.configuracoes (chave, valor, descricao)
values (
  'taxa_empresa_minima', '25',
  'Piso da taxa da empresa. A taxa corrente nunca pode ficar abaixo deste valor.'
)
on conflict (chave) do nothing;

-- ---------------------------------------------------------------------------
-- 1. Gatilho: a taxa nao entra no banco abaixo do piso
-- ---------------------------------------------------------------------------
create or replace function public.validar_configuracao()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  v_taxa numeric;
  v_piso numeric;
begin
  if new.chave = 'taxa_empresa_percentual' then
    v_taxa := nullif(regexp_replace(new.valor, '[^0-9.\-]', '', 'g'), '')::numeric;
    v_piso := public.config_num('taxa_empresa_minima', 25);

    if v_taxa is null then
      raise exception 'Taxa invalida: informe um numero.';
    end if;

    if v_taxa < v_piso then
      raise exception 'A taxa da empresa nao pode ficar abaixo de %.', (v_piso::text || '%');
    end if;

    if v_taxa > 100 then
      raise exception 'A taxa da empresa nao pode passar de 100%%.';
    end if;
  end if;

  if new.chave = 'taxa_empresa_minima' then
    v_piso := nullif(regexp_replace(new.valor, '[^0-9.\-]', '', 'g'), '')::numeric;
    if v_piso is null or v_piso < 0 or v_piso > 100 then
      raise exception 'Piso invalido: informe um numero entre 0 e 100.';
    end if;
  end if;

  new.atualizado_em := now();
  return new;
end;
$fn$;

drop trigger if exists configuracoes_validar on public.configuracoes;
create trigger configuracoes_validar
  before insert or update on public.configuracoes
  for each row execute function public.validar_configuracao();

-- ---------------------------------------------------------------------------
-- 2 e 3. As funcoes de corrida passam a respeitar o piso
-- ---------------------------------------------------------------------------

/** Taxa que vale agora: a configurada, nunca abaixo do piso. */
create or replace function public.taxa_empresa_vigente()
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select greatest(
    public.config_num('taxa_empresa_percentual', 25),
    public.config_num('taxa_empresa_minima', 25)
  );
$fn$;

revoke all on function public.taxa_empresa_vigente() from public, anon;
grant execute on function public.taxa_empresa_vigente() to authenticated;

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
  v_taxa numeric := public.taxa_empresa_vigente();
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

-- Corrige linhas ja gravadas abaixo do piso, se houver.
update public.corridas
   set taxa_empresa_percentual = public.config_num('taxa_empresa_minima', 25)
 where status = 'aberta'
   and coalesce(taxa_empresa_percentual, 0) < public.config_num('taxa_empresa_minima', 25);
