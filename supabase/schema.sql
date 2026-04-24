-- =============================================================
-- SCHEMA: App Estoque Atitudy
-- Execute este arquivo no Supabase: SQL Editor > New Query
-- =============================================================

-- Tabela de Produtos
create table public.produtos (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('Calçados', 'Bolsas', 'Bijuterias')),
  modelo        text not null check (char_length(modelo) >= 2),
  preco_compra  numeric(10,2) not null check (preco_compra >= 0),
  preco_venda   numeric(10,2) not null check (preco_venda >= 0),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Tabela de Variantes (combinações de cor/tamanho de um produto)
create table public.variantes (
  id              uuid primary key default gen_random_uuid(),
  produto_id      uuid not null references public.produtos(id) on delete cascade,
  cor             text not null default '',
  tamanho         text not null default '',
  estoque_minimo  integer not null default 2 check (estoque_minimo >= 0),
  sku_interno     text unique,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  unique (produto_id, cor, tamanho)
);

-- Tabela de Movimentações (append-only: nunca altere ou delete registros)
create table public.movimentacoes (
  id                uuid primary key default gen_random_uuid(),
  variante_id       uuid not null references public.variantes(id),
  tipo_movimentacao text not null check (tipo_movimentacao in ('Entrada', 'Saída', 'Ajuste Manual')),
  quantidade        integer not null check (quantidade > 0),
  observacao        text,
  data_hora         timestamptz not null default now(),
  usuario_id        uuid
);

-- View de saldo por variante (elimina cálculo O(n) no frontend)
create or replace view public.vw_saldo_estoque as
select
  v.id as variante_id,
  coalesce(sum(
    case m.tipo_movimentacao
      when 'Entrada'       then  m.quantidade
      when 'Saída'         then -m.quantidade
      when 'Ajuste Manual' then  m.quantidade
      else 0
    end
  ), 0)::integer as saldo_atual,
  coalesce(sum(case when m.tipo_movimentacao = 'Entrada' then m.quantidade else 0 end), 0)::integer as total_entradas,
  coalesce(sum(case when m.tipo_movimentacao = 'Saída'   then m.quantidade else 0 end), 0)::integer as total_saidas
from public.variantes v
left join public.movimentacoes m on m.variante_id = v.id
group by v.id;

-- Trigger para atualizar atualizado_em automaticamente
create or replace function public.set_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_produtos_atualizado_em
  before update on public.produtos
  for each row execute function public.set_atualizado_em();

create trigger trg_variantes_atualizado_em
  before update on public.variantes
  for each row execute function public.set_atualizado_em();

-- Row Level Security (acesso público por enquanto — sem autenticação)
alter table public.produtos      enable row level security;
alter table public.variantes     enable row level security;
alter table public.movimentacoes enable row level security;

create policy "acesso_total_produtos"      on public.produtos      for all using (true) with check (true);
create policy "acesso_total_variantes"     on public.variantes     for all using (true) with check (true);
create policy "acesso_total_movimentacoes" on public.movimentacoes for all using (true) with check (true);
