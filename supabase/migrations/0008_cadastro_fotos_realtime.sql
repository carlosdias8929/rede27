-- ===========================================================================
-- REDE27 — cadastro por papel, fotos do motorista e Realtime dos alertas
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Cadastro: o gatilho passa a olhar o papel enviado no signUp.
--
-- Antes, TODO usuario novo virava passageiro com carteira. Com o painel do
-- motorista na Fase 1 isso deixaria um motorista com carteira de passageiro e,
-- pior, com CPF ocupando a tabela errada.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_cpf   char(11);
  v_papel text;
begin
  v_cpf := regexp_replace(coalesce(new.raw_user_meta_data ->> 'cpf', ''), '[^0-9]', '', 'g');
  v_papel := lower(coalesce(new.raw_user_meta_data ->> 'papel', 'passageiro'));

  if length(v_cpf) <> 11 then
    raise exception 'CPF ausente ou invalido no cadastro';
  end if;

  if v_papel = 'motorista' then
    insert into public.motoristas (id, cpf, nome, telefone)
    values (
      new.id,
      v_cpf,
      coalesce(new.raw_user_meta_data ->> 'nome', ''),
      coalesce(new.raw_user_meta_data ->> 'telefone', '')
    );
  else
    insert into public.passageiros (id, cpf, nome, telefone)
    values (
      new.id,
      v_cpf,
      coalesce(new.raw_user_meta_data ->> 'nome', ''),
      coalesce(new.raw_user_meta_data ->> 'telefone', '')
    );

    insert into public.carteiras (passageiro_id, saldo_centavos)
    values (new.id, 0);
  end if;

  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fotos do motorista
--
-- Bucket publico de proposito: a foto do motorista e da foto do veiculo sao
-- mostradas ao passageiro justamente para gerar confianca. O que e restrito e a
-- ESCRITA: cada motorista so grava dentro da pasta com o proprio id.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'motoristas', 'motoristas', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists motoristas_fotos_leitura on storage.objects;
create policy motoristas_fotos_leitura on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'motoristas');

drop policy if exists motoristas_fotos_envio on storage.objects;
create policy motoristas_fotos_envio on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'motoristas'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists motoristas_fotos_troca on storage.objects;
create policy motoristas_fotos_troca on storage.objects
  for update to authenticated
  using (
    bucket_id = 'motoristas'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'motoristas'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists motoristas_fotos_remocao on storage.objects;
create policy motoristas_fotos_remocao on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'motoristas'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Realtime
--
-- O painel Admin depende disso para o alerta aparecer sozinho. Sem a tabela na
-- publicacao, a assinatura conecta e nunca recebe nada — falha silenciosa.
-- ---------------------------------------------------------------------------
do $mig$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'alertas_03'
  ) then
    alter publication supabase_realtime add table public.alertas_03;
  end if;
end;
$mig$;

alter table public.alertas_03 replica identity default;
