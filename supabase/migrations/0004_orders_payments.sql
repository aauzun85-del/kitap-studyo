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
