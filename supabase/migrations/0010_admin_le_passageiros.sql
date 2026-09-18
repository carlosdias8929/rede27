-- ===========================================================================
-- REDE27 — o painel Admin precisa ler os passageiros
--
-- Faltava esta policy. `passageiros` so tinha `passageiros_proprio_select`,
-- entao o painel Admin abria o alerta do protocolo 03 com "PASSAGEIRO —" e
-- "sem telefone": a consulta nao falhava, apenas voltava vazia por RLS.
--
-- Isso quebrava exatamente o passo 4 do protocolo, que e ligar para o
-- passageiro. Um alerta de emergencia sem o telefone de quem pediu socorro nao
-- serve para nada.
-- ===========================================================================

drop policy if exists passageiros_admin_select on public.passageiros;
create policy passageiros_admin_select on public.passageiros
  for select to authenticated
  using (public.eh_admin());

-- O Admin tambem acompanha carteiras e extrato para conferir cobranca.
drop policy if exists carteiras_admin_select on public.carteiras;
create policy carteiras_admin_select on public.carteiras
  for select to authenticated
  using (public.eh_admin());

drop policy if exists transacoes_admin_select on public.transacoes;
create policy transacoes_admin_select on public.transacoes
  for select to authenticated
  using (public.eh_admin());

-- O motorista precisa do telefone do passageiro da corrida que ele aceitou,
-- para combinar o embarque. So o da corrida dele, e so enquanto ela existe.
create or replace function public.passageiro_da_minha_corrida(p_passageiro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.corridas c
     where c.passageiro_id = p_passageiro_id
       and c.motorista_id = auth.uid()
       and c.status = 'aberta'
  );
$fn$;

revoke all on function public.passageiro_da_minha_corrida(uuid) from public, anon;
grant execute on function public.passageiro_da_minha_corrida(uuid) to authenticated;

drop policy if exists passageiros_motorista_select on public.passageiros;
create policy passageiros_motorista_select on public.passageiros
  for select to authenticated
  using (public.passageiro_da_minha_corrida(id));
