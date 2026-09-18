-- ===========================================================================
-- REDE27 / REDE BRASIL — corrige o texto do erro do piso da taxa
--
-- A mensagem saia como "abaixo de %25". No plpgsql, '%%' e um por-cento
-- literal e '%' e o marcador do argumento, entao '%%%' e lido como
-- literal + marcador, nessa ordem. Montamos o texto antes de passar para o
-- `raise`, sem depender dessa ordem.
--
-- Vale a migracao separada porque este texto aparece para o cliente no painel
-- Admin quando ele tenta baixar a taxa.
-- ===========================================================================

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
