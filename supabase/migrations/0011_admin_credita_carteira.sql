-- ===========================================================================
-- REDE27 — o Admin passa a creditar carteira pelo painel
--
-- `creditar_carteira` e administrativa e fica fora da API de proposito. Só que
-- sem nenhum caminho pelo painel, colocar saldo exigia abrir o SQL Editor do
-- Supabase — ou seja, a carteira do passageiro so funcionava com um
-- desenvolvedor por perto. Isso nao e carteira, e um campo no banco.
--
-- Aqui entra um invólucro que checa `eh_admin()` antes de chamar a funcao
-- original. A funcao de baixo continua fechada; quem abre a porta e o papel.
-- ===========================================================================

create or replace function public.admin_creditar_carteira(
  p_passageiro_id uuid,
  p_valor_centavos bigint,
  p_descricao text default 'Credito lancado pela central'
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_saldo bigint;
begin
  if not public.eh_admin() then
    raise exception 'Apenas o painel Admin lanca credito.';
  end if;

  if p_valor_centavos is null or p_valor_centavos <= 0 then
    raise exception 'Informe um valor maior que zero.';
  end if;

  -- Teto por lancamento: um zero a mais digitado no painel nao vira R$ 10.000
  -- na carteira de alguem sem ninguem perceber.
  if p_valor_centavos > 100000 then
    raise exception 'Valor acima do limite por lancamento (R$ 1.000,00).';
  end if;

  if not exists (select 1 from public.passageiros where id = p_passageiro_id) then
    raise exception 'Passageiro nao encontrado.';
  end if;

  v_saldo := public.creditar_carteira(p_passageiro_id, p_valor_centavos, p_descricao);
  return v_saldo;
end;
$fn$;

revoke all on function public.admin_creditar_carteira(uuid, bigint, text) from public, anon;
grant execute on function public.admin_creditar_carteira(uuid, bigint, text) to authenticated;
