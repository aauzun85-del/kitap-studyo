-- Kitap Stüdyosu — JETON PAKETLERİ + son kullanma (lot) + satın alma siparişleri.
-- Supabase panelinde SQL editor'e yapıştırıp BİR KEZ çalıştır. (0002'den SONRA.)
--
-- Ne değişiyor:
--   • Jetonlar artık "lot" (parti) bazlı: her satın alma/hoş geldin kendi son
--     kullanma tarihiyle ayrı satır. Satın alınan jetonlar 30 günde yanar,
--     hoş geldin jetonları süresizdir.
--   • credit_orders : havale/EFT satın alma talepleri (beklemede → onay/ret).
--   • approve_credit_order() : admin onaylayınca 30 günlük "purchase" lotu açar.
--   • credit_balance() / has_active_package() : bakiye + indirme erişimi.
--   • spend_credits/refund_credits/hoş geldin tetikleyicisi lot'a göre güncellendi.

-- 1) LOT TABLOSU (her jeton partisi ayrı satır)
create table if not exists public.credit_lots (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  remaining  int  not null check (remaining >= 0),
  source     text not null default 'welcome',  -- welcome | purchase | refund
  expires_at timestamptz,                        -- null = süresiz (hoş geldin)
  created_at timestamptz not null default now()
);

create index if not exists credit_lots_user_idx
  on public.credit_lots (user_id, expires_at nulls last, created_at);

alter table public.credit_lots enable row level security;
drop policy if exists "lots own select" on public.credit_lots;
create policy "lots own select" on public.credit_lots
  for select to authenticated using ( (select auth.uid()) = user_id );

-- Var olan credits.balance'ı (0002'den) hoş geldin lotuna taşı — yalnız bir kez.
insert into public.credit_lots (user_id, remaining, source, expires_at)
  select c.user_id, c.balance, 'welcome', null
  from public.credits c
  where c.balance > 0
    and not exists (
      select 1 from public.credit_lots l where l.user_id = c.user_id
    );

-- 2) BAKİYE = süresi geçmemiş lotların toplamı
create or replace function public.credit_balance(p_uid uuid)
returns int
language sql stable security definer set search_path = public
as $bal$
  select coalesce(sum(remaining), 0)::int
  from public.credit_lots
  where user_id = p_uid and (expires_at is null or expires_at > now());
$bal$;

-- 3) AKTİF PAKET var mı? (indirme/dışa aktarma erişimi bununla açılır)
create or replace function public.has_active_package(p_uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $act$
  select exists(
    select 1 from public.credit_lots
    where user_id = p_uid and source = 'purchase'
      and expires_at is not null and expires_at > now()
  );
$act$;

grant execute on function public.credit_balance(uuid) to authenticated;
grant execute on function public.has_active_package(uuid) to authenticated;

-- 4) HARCAMA — lot bazlı, süresi en yakın lottan başlayarak düşer.
create or replace function public.spend_credits(p_cost int, p_action text)
returns int
language plpgsql security definer set search_path = public
as $spend$
declare
  v_uid uuid := auth.uid();
  v_avail int;
  v_left int := p_cost;
  r record;
begin
  if v_uid is null then raise exception 'not-authenticated'; end if;

  select coalesce(sum(remaining), 0) into v_avail
  from public.credit_lots
  where user_id = v_uid and (expires_at is null or expires_at > now());

  if v_avail < p_cost then raise exception 'insufficient-credits'; end if;

  for r in
    select id, remaining from public.credit_lots
    where user_id = v_uid and remaining > 0
      and (expires_at is null or expires_at > now())
    order by expires_at nulls last, created_at
    for update
  loop
    exit when v_left <= 0;
    if r.remaining <= v_left then
      update public.credit_lots set remaining = 0 where id = r.id;
      v_left := v_left - r.remaining;
    else
      update public.credit_lots set remaining = remaining - v_left where id = r.id;
      v_left := 0;
    end if;
  end loop;

  insert into public.credit_ledger (user_id, delta, action)
    values (v_uid, -p_cost, p_action);

  return public.credit_balance(v_uid);
end;
$spend$;

-- 5) İADE — başarısız işlemde jetonu yeni (süresiz) bir lot olarak geri ver.
create or replace function public.refund_credits(p_uid uuid, p_cost int, p_action text)
returns int
language plpgsql security definer set search_path = public
as $refund$
begin
  insert into public.credit_lots (user_id, remaining, source, expires_at)
    values (p_uid, p_cost, 'refund', null);
  insert into public.credit_ledger (user_id, delta, action)
    values (p_uid, p_cost, p_action || ':iade');
  return public.credit_balance(p_uid);
end;
$refund$;

-- 6) YENİ ÜYE — 100 jetonluk süresiz hoş geldin lotu.
create or replace function public.grant_welcome_credits()
returns trigger
language plpgsql security definer set search_path = public
as $welcome$
begin
  insert into public.credit_lots (user_id, remaining, source, expires_at)
    values (new.id, 100, 'welcome', null);
  return new;
end;
$welcome$;
-- (Tetikleyici 0002'de kuruldu; fonksiyon gövdesi burada güncellendi.)

-- 7) SATIN ALMA SİPARİŞLERİ (havale/EFT)
create table if not exists public.credit_orders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  email      text not null default '',        -- admin listesinde kolay görünsün
  package_id text not null,
  credits    int  not null,
  price_try  int  not null,
  ref_code   text not null,
  status     text not null default 'pending',  -- pending | approved | rejected
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists credit_orders_user_idx
  on public.credit_orders (user_id, created_at desc);
create index if not exists credit_orders_status_idx
  on public.credit_orders (status, created_at desc);

alter table public.credit_orders enable row level security;
-- Kullanıcı yalnız KENDİ siparişlerini görür. Yazma yalnız sunucu (service role).
drop policy if exists "orders own select" on public.credit_orders;
create policy "orders own select" on public.credit_orders
  for select to authenticated using ( (select auth.uid()) = user_id );

-- 8) SİPARİŞ ONAYI (admin/service-role) — 30 günlük purchase lotu açar.
create or replace function public.approve_credit_order(p_order_id uuid, p_valid_days int)
returns void
language plpgsql security definer set search_path = public
as $appr$
declare
  o public.credit_orders%rowtype;
begin
  select * into o from public.credit_orders where id = p_order_id for update;
  if not found then raise exception 'order-not-found'; end if;
  if o.status <> 'pending' then raise exception 'order-not-pending'; end if;

  insert into public.credit_lots (user_id, remaining, source, expires_at)
    values (o.user_id, o.credits, 'purchase', now() + make_interval(days => p_valid_days));

  insert into public.credit_ledger (user_id, delta, action)
    values (o.user_id, o.credits, 'satin-alma:' || o.package_id);

  update public.credit_orders
    set status = 'approved', decided_at = now()
  where id = p_order_id;
end;
$appr$;

grant execute on function public.approve_credit_order(uuid, int) to service_role;
