-- ===========================================================================
-- REDE27 — fixa o search_path da funcao de distancia
--
-- `distancia_km` e matematica pura, mas sem `search_path` fixo um role com
-- search_path proprio poderia fazer os operadores resolverem para outro schema.
-- O linter do Supabase aponta isso como `function_search_path_mutable`.
-- ===========================================================================

create or replace function public.distancia_km(
  p_lat1 numeric, p_lng1 numeric, p_lat2 numeric, p_lng2 numeric
)
returns numeric
language sql
immutable
set search_path = pg_catalog, pg_temp
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
