-- LAYCOTY — JETON v2 KURULUMU (0003 + 0004 + 0005 birleşik)
-- Supabase → SQL Editor'e TAMAMINI yapıştır, bir kez Run'a bas.
-- Tek işlem olarak çalışır: hata olursa hiçbir şey değişmez.
begin;

-- ======== 0003_credit_packages ========
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

-- ======== 0004_orders_payments ========
-- 0004 — Siparişlere ödeme yolu + PayTR hazırlığı (Yönetim: Siparişler/Müşteriler/Ürünler).
-- 0003_credit_packages.sql'den SONRA, Supabase SQL panelinde bir kez çalıştırılır.
-- Tekrar çalıştırmak zararsızdır (if not exists / create or replace).

-- 1) Yeni sütunlar
alter table public.credit_orders
  add column if not exists payment_method text not null default 'havale', -- havale | paytr
  add column if not exists provider_ref   text,        -- PayTR merchant_oid (kart ödemesi)
  add column if not exists paid_at        timestamptz, -- ödemenin onaylandığı an
  add column if not exists failure_reason text,        -- PayTR başarısız ödeme açıklaması
  add column if not exists terms_accepted_at timestamptz; -- Ön Bilgilendirme + Mesafeli Satış onayı anı

-- status değerleri: pending (bekliyor) | approved (ödendi) | rejected (reddedildi)
--                   | failed (kart ödemesi başarısız) | refunded (iade edildi)

-- Aynı PayTR işlemi iki kez yazılmasın (bildirim tekrar gelebilir → idempotent).
create unique index if not exists credit_orders_provider_ref_uidx
  on public.credit_orders (provider_ref) where provider_ref is not null;

-- 2) Onay: artık ödeme tarihini de yazar (havale onayı ya da PayTR bildirimi).
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
    set status = 'approved', decided_at = now(), paid_at = coalesce(paid_at, now())
  where id = p_order_id;
end;
$appr$;

grant execute on function public.approve_credit_order(uuid, int) to service_role;

-- ======== 0005_jeton_guvenlik_fatura ========
-- Laycoty — JETON v2: güvenlik düzeltmeleri + ek jeton + elle tanımlama + fatura alanları.
-- 0003 ve 0004'ten SONRA çalıştırılır. Tekrar çalıştırmak zararsızdır.
-- DİKKAT: Bu dosyadan sonra 0002/0003/0004 YENİDEN ÇALIŞTIRILMAZ (düzeltmeleri geri alır).
--
-- Ne yapar:
--   • Açıkları kapatır: üye kendine jeton yazamaz, kendi siparişini onaylayamaz,
--     eşzamanlı isteklerle bedava işlem yapamaz.
--   • İade, jetonu düştüğü lota geri koyar (süreli jeton süresiz olmaz; çift iade olmaz).
--   • Ek jeton ("addon") indirme hakkı vermez; yalnız paket ("purchase") verir.
--   • Yönetici elle jeton/paket tanımlayabilir (kim, neden: deftere yazılır).
--   • Siparişlere fatura bilgileri + fatura durumu eklenir.

-- ───────────────────────── A) LOTLAR ─────────────────────────
alter table public.credit_lots
  add column if not exists order_id   uuid,
  add column if not exists product_id text;

alter table public.credit_lots drop constraint if exists credit_lots_source_chk;
alter table public.credit_lots add constraint credit_lots_source_chk
  check (source in ('welcome', 'purchase', 'addon', 'grant', 'refund'));

-- Ölçüm açılmadan önce 100'ün üstünde hoş geldin bakiyesi meşru yoldan oluşamaz.
update public.credit_lots set remaining = 100 where source = 'welcome' and remaining > 100;

-- Hiç lotu olmayan üyeye hoş geldin lotu (tetikleyici atlanmış olabilir).
insert into public.credit_lots (user_id, remaining, source, expires_at)
  select u.id, 100, 'welcome', null
  from auth.users u
  where not exists (select 1 from public.credit_lots l where l.user_id = u.id)
    and not exists (select 1 from public.credits c where c.user_id = u.id and c.balance <= 0);

create index if not exists credit_lots_order_idx
  on public.credit_lots (order_id) where order_id is not null;

comment on table public.credits is 'ESKİ — 0003 sonrası kullanılmıyor; bakiye credit_lots toplamıdır.';

-- ───────────────────────── B) DEFTER ─────────────────────────
alter table public.credit_ledger
  add column if not exists kind        text not null default 'spend',
  add column if not exists order_id    uuid,
  add column if not exists actor       text,        -- elle işlemi yapan yönetici e-postası
  add column if not exists note        text,
  add column if not exists lots        jsonb,       -- harcamanın düştüğü lotlar [{lot,n}]
  add column if not exists refunded_at timestamptz; -- bu harcama iade edildiyse

update public.credit_ledger set kind = case
    when action like '%:iade' then 'refund'
    when action like 'satin-alma:%' then 'purchase'
    else 'spend' end
  where kind = 'spend' and delta > 0;

alter table public.credit_ledger drop constraint if exists credit_ledger_kind_chk;
alter table public.credit_ledger add constraint credit_ledger_kind_chk
  check (kind in ('spend', 'refund', 'purchase', 'addon', 'grant', 'welcome'));

create index if not exists credit_ledger_created_idx on public.credit_ledger (created_at desc);

-- ───────────────────────── C) SİPARİŞLER ─────────────────────────
alter table public.credit_orders
  add column if not exists product_kind       text not null default 'package', -- package | addon | grant
  add column if not exists billing_type       text,   -- bireysel | kurumsal
  add column if not exists billing_name       text,
  add column if not exists billing_tax_id     text,
  add column if not exists billing_tax_office text,
  add column if not exists billing_email      text,
  add column if not exists billing_address    text,
  add column if not exists billing_district   text,
  add column if not exists billing_city       text,
  add column if not exists invoice_status     text not null default 'none', -- none | pending | issued | error
  add column if not exists invoice_no         text,
  add column if not exists invoice_url        text,
  add column if not exists invoice_error      text,
  add column if not exists invoiced_at        timestamptz,
  add column if not exists created_by         text,   -- elle tanımlandıysa yönetici e-postası
  add column if not exists admin_note         text;

alter table public.credit_orders drop constraint if exists credit_orders_kind_chk;
alter table public.credit_orders add constraint credit_orders_kind_chk
  check (product_kind in ('package', 'addon', 'grant'));
alter table public.credit_orders drop constraint if exists credit_orders_invoice_chk;
alter table public.credit_orders add constraint credit_orders_invoice_chk
  check (invoice_status in ('none', 'pending', 'issued', 'error'));

-- ───────────────────────── D) FONKSİYONLAR ─────────────────────────

-- Bakiye / aktif paket: üye yalnız KENDİ bilgisini sorabilir (sunucu herkesinkini).
create or replace function public.credit_balance(p_uid uuid)
returns int
language sql stable security definer set search_path = public
as $bal$
  select coalesce(sum(remaining), 0)::int
  from public.credit_lots
  where user_id = p_uid and (expires_at is null or expires_at > now())
    and (auth.uid() is null or auth.uid() = p_uid);
$bal$;

create or replace function public.has_active_package(p_uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $act$
  select exists(
    select 1 from public.credit_lots
    where user_id = p_uid and source = 'purchase'
      and expires_at is not null and expires_at > now()
      and (auth.uid() is null or auth.uid() = p_uid)
  );
$act$;

-- HARCAMA: tutar denetimi + üye başına kilit + düştüğü lotları deftere yazar.
create or replace function public.spend_credits(p_cost int, p_action text)
returns int
language plpgsql security definer set search_path = public
as $spend$
declare
  v_uid   uuid := auth.uid();
  v_avail int;
  v_left  int := p_cost;
  v_take  int;
  v_parts jsonb := '[]'::jsonb;
  r record;
begin
  if v_uid is null then raise exception 'not-authenticated'; end if;
  if p_cost is null or p_cost <= 0 or p_cost > 1000 then raise exception 'bad-cost'; end if;

  -- Aynı üyenin eşzamanlı istekleri sıraya girer (çifte harcama / bedava işlem olmaz).
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

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
    v_take := least(r.remaining, v_left);
    update public.credit_lots set remaining = remaining - v_take where id = r.id;
    v_parts := v_parts || jsonb_build_object('lot', r.id, 'n', v_take);
    v_left := v_left - v_take;
  end loop;

  if v_left > 0 then raise exception 'insufficient-credits'; end if;

  insert into public.credit_ledger (user_id, delta, action, kind, lots)
    values (v_uid, -p_cost, coalesce(p_action, ''), 'spend', v_parts);

  return public.credit_balance(v_uid);
end;
$spend$;

-- İADE: yalnız sunucu çağırır. Son 2 saatteki, henüz iade edilmemiş EŞLEŞEN
-- harcamayı bulur ve jetonu düştüğü lotlara geri koyar. Eşleşme yoksa hiçbir
-- şey yapmaz (uydurma ya da çift iade olmaz).
create or replace function public.refund_credits(p_uid uuid, p_cost int, p_action text)
returns int
language plpgsql security definer set search_path = public
as $refund$
declare
  g record;
  part jsonb;
begin
  if p_uid is null or p_cost is null or p_cost <= 0 then return public.credit_balance(p_uid); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_uid::text, 0));

  select id, lots into g
  from public.credit_ledger
  where user_id = p_uid and kind = 'spend' and action = coalesce(p_action, '')
    and delta = -p_cost and refunded_at is null
    and created_at > now() - interval '2 hours'
  order by created_at desc
  limit 1
  for update;

  if not found then return public.credit_balance(p_uid); end if;

  if g.lots is not null and jsonb_array_length(g.lots) > 0 then
    for part in select * from jsonb_array_elements(g.lots) loop
      update public.credit_lots
        set remaining = remaining + (part->>'n')::int
      where id = (part->>'lot')::uuid and user_id = p_uid;
    end loop;
  else
    -- Eski biçimli (lot kaydı olmayan) harcama: 30 günlük iade lotu.
    insert into public.credit_lots (user_id, remaining, source, expires_at)
      values (p_uid, p_cost, 'refund', now() + interval '30 days');
  end if;

  update public.credit_ledger set refunded_at = now() where id = g.id;
  insert into public.credit_ledger (user_id, delta, action, kind)
    values (p_uid, p_cost, coalesce(p_action, '') || ':iade', 'refund');

  return public.credit_balance(p_uid);
end;
$refund$;

-- YENİ ÜYE: 100 jetonluk süresiz hoş geldin lotu. Hata olursa üyelik durmaz.
create or replace function public.grant_welcome_credits()
returns trigger
language plpgsql security definer set search_path = public
as $welcome$
begin
  begin
    if not exists (select 1 from public.credit_lots where user_id = new.id and source = 'welcome') then
      insert into public.credit_lots (user_id, remaining, source, expires_at)
        values (new.id, 100, 'welcome', null);
      insert into public.credit_ledger (user_id, delta, action, kind)
        values (new.id, 100, 'hos-geldin', 'welcome');
    end if;
  exception when others then
    raise warning 'grant_welcome_credits: %', sqlerrm;
  end;
  return new;
end;
$welcome$;

drop trigger if exists on_auth_user_created_credits on auth.users;
create trigger on_auth_user_created_credits
  after insert on auth.users
  for each row execute function public.grant_welcome_credits();

-- SİPARİŞ ONAYI: paket → 'purchase' (indirme açar), ek jeton → 'addon',
-- hediye/elle jeton → 'grant'. Ücretliyse fatura "kesilecek" olarak işaretlenir.
create or replace function public.approve_credit_order(p_order_id uuid, p_valid_days int)
returns void
language plpgsql security definer set search_path = public
as $appr$
declare
  o public.credit_orders%rowtype;
  v_source text;
begin
  if p_valid_days is null or p_valid_days < 1 or p_valid_days > 366 then
    raise exception 'bad-days';
  end if;
  select * into o from public.credit_orders where id = p_order_id for update;
  if not found then raise exception 'order-not-found'; end if;
  if o.status <> 'pending' then raise exception 'order-not-pending'; end if;
  if o.credits is null or o.credits <= 0 then raise exception 'bad-credits'; end if;

  v_source := case o.product_kind when 'package' then 'purchase' when 'addon' then 'addon' else 'grant' end;

  insert into public.credit_lots (user_id, remaining, source, expires_at, order_id, product_id)
    values (o.user_id, o.credits, v_source, now() + make_interval(days => p_valid_days), o.id, o.package_id);

  insert into public.credit_ledger (user_id, delta, action, kind, order_id, actor, note)
    values (o.user_id, o.credits, 'satin-alma:' || o.package_id,
            case when v_source = 'purchase' then 'purchase' when v_source = 'addon' then 'addon' else 'grant' end,
            o.id, o.created_by, o.admin_note);

  update public.credit_orders
    set status = 'approved', decided_at = now(), paid_at = coalesce(paid_at, now()),
        invoice_status = case when invoice_status = 'issued' then 'issued'
                              when price_try > 0 then 'pending' else 'none' end
  where id = p_order_id;
end;
$appr$;

-- ELLE JETON: yönetici bir üyeye sipariş açmadan jeton ekler (ör. telafi, deneme).
-- p_days null = süresiz.
create or replace function public.admin_grant_credits(
  p_uid uuid, p_credits int, p_days int, p_actor text, p_note text)
returns int
language plpgsql security definer set search_path = public
as $grant$
begin
  if p_uid is null or not exists (select 1 from auth.users where id = p_uid) then
    raise exception 'user-not-found';
  end if;
  if p_credits is null or p_credits <= 0 or p_credits > 100000 then raise exception 'bad-credits'; end if;
  if p_days is not null and (p_days < 1 or p_days > 366) then raise exception 'bad-days'; end if;

  insert into public.credit_lots (user_id, remaining, source, expires_at)
    values (p_uid, p_credits, 'grant',
            case when p_days is null then null else now() + make_interval(days => p_days) end);
  insert into public.credit_ledger (user_id, delta, action, kind, actor, note)
    values (p_uid, p_credits, 'elle-jeton', 'grant', p_actor, p_note);
  return public.credit_balance(p_uid);
end;
$grant$;

-- ───────────────────────── E) YETKİLER ─────────────────────────
-- Supabase yeni fonksiyonlara anon/authenticated için de izin verir; hepsini
-- geri al, yalnız gerekenleri ver.
revoke all on function public.spend_credits(int, text)              from public, anon, authenticated;
revoke all on function public.credit_balance(uuid)                  from public, anon, authenticated;
revoke all on function public.has_active_package(uuid)              from public, anon, authenticated;
revoke all on function public.refund_credits(uuid, int, text)       from public, anon, authenticated;
revoke all on function public.approve_credit_order(uuid, int)       from public, anon, authenticated;
revoke all on function public.admin_grant_credits(uuid, int, int, text, text) from public, anon, authenticated;
revoke all on function public.grant_welcome_credits()               from public, anon, authenticated;

grant execute on function public.spend_credits(int, text)     to authenticated, service_role;
grant execute on function public.credit_balance(uuid)         to authenticated, service_role;
grant execute on function public.has_active_package(uuid)     to authenticated, service_role;
grant execute on function public.refund_credits(uuid, int, text) to service_role;
grant execute on function public.approve_credit_order(uuid, int) to service_role;
grant execute on function public.admin_grant_credits(uuid, int, int, text, text) to service_role;

commit;
