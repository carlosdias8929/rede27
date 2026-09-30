-- ===========================================================================
-- REDE27 / REDE BRASIL — recarga da carteira por PIX manual
--
-- Fluxo definido pelo cliente:
--   "passageiro escolhe PIX, envia foto do comprovante, entra na fila do painel
--    Admin pra gente aprovar/recusar, e aprovado entra na carteira."
--
-- O que isto E:
--   - o passageiro ve a chave e o QR Code da conta da empresa, paga no app do
--     banco dele e manda a foto do comprovante;
--   - o pedido cai numa fila no painel Admin;
--   - o Admin confere no extrato do banco e aprova (credita) ou recusa (com
--     motivo). Aprovar credita UMA vez, com trava de linha.
--
-- O que isto NAO E:
--   - nao e gateway: o sistema nao fala com banco nenhum e nao sabe sozinho se
--     o PIX caiu. Quem confirma e uma pessoa olhando o extrato;
--   - o comprovante e so um indicio. Foto de comprovante se falsifica; por
--     isso a aprovacao e manual e o Admin confere o extrato antes.
--
-- Seguranca:
--   - o passageiro nao escreve na tabela direto: so pela funcao
--     `solicitar_recarga_pix`, que confere conta, valor, limite de pedidos e
--     se o arquivo do comprovante realmente foi enviado por ele;
--   - o bucket `comprovantes` e PRIVADO: so o dono e o Admin leem, e ninguem
--     troca nem apaga um comprovante depois de enviado;
--   - aprovar e recusar sao exclusivos do Admin (`eh_admin()`).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Cidade que vai no QR Code PIX (campo obrigatorio do padrao do Banco Central)
-- ---------------------------------------------------------------------------
insert into public.configuracoes (chave, valor, descricao) values
  ('empresa_cidade', 'Feira de Santana',
   'Cidade da empresa. Vai dentro do QR Code PIX (padrao do Banco Central).')
on conflict (chave) do nothing;

-- ---------------------------------------------------------------------------
-- Pedidos de recarga
-- ---------------------------------------------------------------------------
create table if not exists public.recargas_pix (
  id                      uuid primary key default gen_random_uuid(),
  passageiro_id           uuid not null references public.passageiros(id) on delete cascade,
  conta_id                uuid references public.contas_recebimento(id) on delete set null,
  -- Copia da conta no momento do pedido: se o Admin trocar ou apagar a chave
  -- depois, o historico continua dizendo para onde o passageiro pagou.
  conta_banco             text not null,
  conta_chave             text not null,
  valor_centavos          bigint not null check (valor_centavos > 0 and valor_centavos <= 100000),
  -- Vai no QR Code como identificador (txid) e aparece para o Admin conferir.
  codigo_referencia       text not null check (codigo_referencia ~ '^[A-Za-z0-9]{1,25}$'),
  comprovante_path        text not null unique,
  status                  text not null default 'pendente'
                            check (status in ('pendente', 'aprovada', 'recusada')),
  valor_aprovado_centavos bigint check (valor_aprovado_centavos is null or valor_aprovado_centavos > 0),
  motivo_recusa           text,
  criada_em               timestamptz not null default now(),
  analisada_em            timestamptz,
  analisada_por           uuid references auth.users(id) on delete set null
);

comment on table public.recargas_pix is
  'Recarga manual por PIX: comprovante enviado pelo passageiro, aprovado ou recusado pelo Admin.';

create index if not exists recargas_pix_status_idx
  on public.recargas_pix (status, criada_em desc);
create index if not exists recargas_pix_passageiro_idx
  on public.recargas_pix (passageiro_id, criada_em desc);

alter table public.recargas_pix enable row level security;

-- Leitura: o passageiro ve os proprios pedidos; o Admin ve todos.
-- Escrita: nenhuma policy. So as funcoes abaixo gravam.
drop policy if exists recargas_leitura_dono on public.recargas_pix;
create policy recargas_leitura_dono on public.recargas_pix
  for select to authenticated
  using (passageiro_id = (select auth.uid()));

drop policy if exists recargas_leitura_admin on public.recargas_pix;
create policy recargas_leitura_admin on public.recargas_pix
  for select to authenticated
  using (public.eh_admin());

-- ---------------------------------------------------------------------------
-- Bucket privado dos comprovantes
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprovantes', 'comprovantes', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Envio: so na propria pasta.
drop policy if exists comprovantes_envio on storage.objects;
create policy comprovantes_envio on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Leitura: o dono e o Admin. Sem policy de update/delete: comprovante enviado
-- nao se troca nem se apaga pelo aplicativo.
drop policy if exists comprovantes_leitura on storage.objects;
create policy comprovantes_leitura on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprovantes'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.eh_admin()
    )
  );

-- ---------------------------------------------------------------------------
-- Passageiro: registrar o pedido depois de enviar o comprovante
-- ---------------------------------------------------------------------------
create or replace function public.solicitar_recarga_pix(
  p_conta_id uuid,
  p_valor_centavos bigint,
  p_comprovante_path text,
  p_codigo_referencia text
)
returns public.recargas_pix
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
  v_conta public.contas_recebimento;
  v_recarga public.recargas_pix;
begin
  if v_uid is null then
    raise exception 'Sessao expirada. Entre novamente.';
  end if;

  if not exists (select 1 from public.passageiros where id = v_uid) then
    raise exception 'Somente passageiros fazem recarga.';
  end if;

  if p_valor_centavos is null or p_valor_centavos <= 0 then
    raise exception 'Informe um valor maior que zero.';
  end if;

  if p_valor_centavos < 100 then
    raise exception 'O valor minimo da recarga e R$ 1,00.';
  end if;

  if p_valor_centavos > 100000 then
    raise exception 'Valor acima do limite por recarga (R$ 1.000,00).';
  end if;

  select * into v_conta from public.contas_recebimento
   where id = p_conta_id and ativa;

  if v_conta.id is null then
    raise exception 'Conta PIX indisponivel. Escolha outra conta.';
  end if;

  if coalesce(p_codigo_referencia, '') !~ '^[A-Za-z0-9]{1,25}$' then
    raise exception 'Codigo da recarga invalido.';
  end if;

  -- O comprovante tem de estar na pasta de quem pede, e tem de existir.
  if split_part(coalesce(p_comprovante_path, ''), '/', 1) <> v_uid::text then
    raise exception 'Comprovante invalido.';
  end if;

  if not exists (
    select 1 from storage.objects
     where bucket_id = 'comprovantes' and name = p_comprovante_path
  ) then
    raise exception 'Envie a foto do comprovante antes de confirmar.';
  end if;

  if exists (select 1 from public.recargas_pix where comprovante_path = p_comprovante_path) then
    raise exception 'Este comprovante ja foi enviado.';
  end if;

  -- Freio contra fila entupida: ate 3 pedidos aguardando por passageiro.
  if (select count(*) from public.recargas_pix
       where passageiro_id = v_uid and status = 'pendente') >= 3 then
    raise exception 'Voce ja tem 3 recargas aguardando conferencia. Aguarde a analise.';
  end if;

  insert into public.recargas_pix (
    passageiro_id, conta_id, conta_banco, conta_chave,
    valor_centavos, codigo_referencia, comprovante_path
  )
  values (
    v_uid, v_conta.id, v_conta.banco, v_conta.chave,
    p_valor_centavos, upper(p_codigo_referencia), p_comprovante_path
  )
  returning * into v_recarga;

  return v_recarga;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Admin: aprovar (credita a carteira uma unica vez)
-- ---------------------------------------------------------------------------
create or replace function public.aprovar_recarga_pix(
  p_recarga_id uuid,
  p_valor_centavos bigint default null
)
returns public.recargas_pix
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_recarga public.recargas_pix;
  v_valor bigint;
begin
  if not public.eh_admin() then
    raise exception 'Apenas o painel Admin aprova recarga.';
  end if;

  -- Trava a linha: dois cliques em "Aprovar" (ou dois admins ao mesmo tempo)
  -- nao podem creditar duas vezes.
  select * into v_recarga from public.recargas_pix
   where id = p_recarga_id
     for update;

  if v_recarga.id is null then
    raise exception 'Recarga nao encontrada.';
  end if;

  if v_recarga.status <> 'pendente' then
    raise exception 'Esta recarga ja foi analisada.';
  end if;

  -- O Admin pode aprovar o valor que de fato caiu no extrato, se for diferente
  -- do que o passageiro informou.
  v_valor := coalesce(p_valor_centavos, v_recarga.valor_centavos);

  if v_valor <= 0 then
    raise exception 'Informe um valor maior que zero.';
  end if;

  if v_valor > 100000 then
    raise exception 'Valor acima do limite por recarga (R$ 1.000,00).';
  end if;

  perform public.creditar_carteira(
    v_recarga.passageiro_id,
    v_valor,
    'Recarga PIX aprovada - ' || v_recarga.conta_banco || ' - ' || v_recarga.codigo_referencia
  );

  update public.recargas_pix
     set status = 'aprovada',
         valor_aprovado_centavos = v_valor,
         analisada_em = now(),
         analisada_por = auth.uid()
   where id = p_recarga_id
  returning * into v_recarga;

  return v_recarga;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Admin: recusar (nao credita nada; o motivo aparece para o passageiro)
-- ---------------------------------------------------------------------------
create or replace function public.recusar_recarga_pix(
  p_recarga_id uuid,
  p_motivo text
)
returns public.recargas_pix
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_recarga public.recargas_pix;
begin
  if not public.eh_admin() then
    raise exception 'Apenas o painel Admin recusa recarga.';
  end if;

  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo da recusa. O passageiro vai ver.';
  end if;

  select * into v_recarga from public.recargas_pix
   where id = p_recarga_id
     for update;

  if v_recarga.id is null then
    raise exception 'Recarga nao encontrada.';
  end if;

  if v_recarga.status <> 'pendente' then
    raise exception 'Esta recarga ja foi analisada.';
  end if;

  update public.recargas_pix
     set status = 'recusada',
         motivo_recusa = trim(p_motivo),
         analisada_em = now(),
         analisada_por = auth.uid()
   where id = p_recarga_id
  returning * into v_recarga;

  return v_recarga;
end;
$fn$;

revoke all on function public.solicitar_recarga_pix(uuid, bigint, text, text) from public, anon;
grant execute on function public.solicitar_recarga_pix(uuid, bigint, text, text) to authenticated;

revoke all on function public.aprovar_recarga_pix(uuid, bigint) from public, anon;
grant execute on function public.aprovar_recarga_pix(uuid, bigint) to authenticated;

revoke all on function public.recusar_recarga_pix(uuid, text) from public, anon;
grant execute on function public.recusar_recarga_pix(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: a fila do Admin e o status do passageiro atualizam sozinhos
-- ---------------------------------------------------------------------------
do $mig$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recargas_pix'
  ) then
    alter publication supabase_realtime add table public.recargas_pix;
  end if;
end;
$mig$;

-- ---------------------------------------------------------------------------
-- Contas PIX definidas pelo cliente: so duas.
--   Santander - REDE BRASIL HOJE LTDA - CNPJ 62.142.941/0001-17
--   Nubank    - CNPJ 53.077.671/0001-17 (BAHIA HOJE COMUNICACAO)
-- BTG Pactual e a chave de celular saem. Depois disso, tudo e editado pelo
-- painel Admin, aba "Empresa e PIX".
-- ---------------------------------------------------------------------------
delete from public.contas_recebimento
 where not (chave = '62142941000117' or chave = '53077671000117');

update public.contas_recebimento
   set banco = 'Santander', tipo_chave = 'cnpj', titular = 'REDE BRASIL HOJE LTDA',
       ativa = true, ordem = 1, atualizado_em = now()
 where chave = '62142941000117';

insert into public.contas_recebimento (banco, tipo_chave, chave, titular, ordem)
select 'Nubank', 'cnpj', '53077671000117', 'BAHIA HOJE COMUNICACAO', 2
 where not exists (select 1 from public.contas_recebimento where chave = '53077671000117');

update public.contas_recebimento
   set banco = 'Nubank', tipo_chave = 'cnpj', titular = 'BAHIA HOJE COMUNICACAO',
       ativa = true, ordem = 2, atualizado_em = now()
 where chave = '53077671000117';
