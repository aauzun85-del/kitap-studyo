-- Kitap Stüdyosu — JETON (kredi) altyapısı.
-- Supabase panelinde SQL editor'e yapıştırıp BİR KEZ çalıştır.
--
-- Ne yapar:
--   • credits          : her kullanıcının jeton bakiyesi (yeni üyeye 100 jeton).
--   • credit_ledger    : her harcama/iade kaydı (şeffaflık + geçmiş).
--   • spend_credits()  : işlem yapmadan ÖNCE atomik olarak bakiyeyi düşer;
--                        bakiye yetmezse hata verir (aşırı harcama imkânsız).
--   • refund_credits() : işlem başarısız olursa yakılan jetonu geri yatırır.
--   • yeni üye tetikleyicisi + mevcut üyelere geriye dönük 100 jeton.

create extension if not exists pgcrypto;

-- 1) BAKİYE TABLOSU (kullanıcı başına tek satır)
create table if not exists public.credits (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  balance    int  not null default 100,   -- hoş geldin bakiyesi
  updated_at timestamptz not null default now()
);

-- 2) HAREKET DEFTERİ (her jeton hareketi: - harcama, + iade/yükleme)
create table if not exists public.credit_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  delta      int  not null,               -- negatif = harcama, pozitif = iade/ekleme
  action     text not null default '',    -- hangi işlem (ör. "cover-art")
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_idx
  on public.credit_ledger (user_id, created_at desc);

-- 3) ROW LEVEL SECURITY
-- Kullanıcı yalnız KENDİ bakiyesini/hareketini GÖREBİLİR. Bakiyeyi kimse
-- doğrudan DEĞİŞTİREMEZ — yalnız aşağıdaki güvenli fonksiyonlar (security
-- definer) değiştirir. Böylece kimse kendine jeton ekleyemez.
alter table public.credits enable row level security;
alter table public.credit_ledger enable row level security;

drop policy if exists "credits own select" on public.credits;
create policy "credits own select" on public.credits
  for select to authenticated using ( (select auth.uid()) = user_id );

drop policy if exists "ledger own select" on public.credit_ledger;
create policy "ledger own select" on public.credit_ledger
  for select to authenticated using ( (select auth.uid()) = user_id );

-- 4) JETON HARCAMA — atomik. İşlemden ÖNCE çağrılır.
--    Bakiye >= p_cost ise düşer ve yeni bakiyeyi döndürür; değilse hata verir.
create or replace function public.spend_credits(p_cost int, p_action text)
returns int
language plpgsql
security definer
set search_path = public
as $spend$
declare
  v_uid uuid := auth.uid();
  v_balance int;
begin
  if v_uid is null then
    raise exception 'not-authenticated';
  end if;

  -- Satır yoksa hoş geldin bakiyesiyle oluştur (tetikleyici atlanmış olabilir).
  insert into public.credits (user_id) values (v_uid)
    on conflict (user_id) do nothing;

  -- Atomik düşüm: yalnız bakiye yetiyorsa güncellenir.
  update public.credits
     set balance = balance - p_cost, updated_at = now()
   where user_id = v_uid and balance >= p_cost
   returning balance into v_balance;

  if v_balance is null then
    raise exception 'insufficient-credits';
  end if;

  insert into public.credit_ledger (user_id, delta, action)
    values (v_uid, -p_cost, p_action);

  return v_balance;
end;
$spend$;

-- 5) JETON İADESİ — işlem başarısız olursa sunucu (service-role) çağırır.
--    Kullanıcının kendisi çağıramaz (grant yok); yalnız güvenli sunucu tarafı.
create or replace function public.refund_credits(p_uid uuid, p_cost int, p_action text)
returns int
language plpgsql
security definer
set search_path = public
as $refund$
declare
  v_balance int;
begin
  update public.credits
     set balance = balance + p_cost, updated_at = now()
   where user_id = p_uid
   returning balance into v_balance;

  if v_balance is not null then
    insert into public.credit_ledger (user_id, delta, action)
      values (p_uid, p_cost, p_action || ':iade');
  end if;

  return v_balance;
end;
$refund$;

-- Fonksiyonların çağrılabilmesi için yetkiler:
revoke all on function public.spend_credits(int, text) from public;
grant execute on function public.spend_credits(int, text) to authenticated;
revoke all on function public.refund_credits(uuid, int, text) from public;
grant execute on function public.refund_credits(uuid, int, text) to service_role;

-- 6) YENİ ÜYE TETİKLEYİCİSİ — kayıt olan herkese 100 jeton.
create or replace function public.grant_welcome_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $welcome$
begin
  insert into public.credits (user_id, balance) values (new.id, 100)
    on conflict (user_id) do nothing;
  return new;
end;
$welcome$;

drop trigger if exists on_auth_user_created_credits on auth.users;
create trigger on_auth_user_created_credits
  after insert on auth.users
  for each row execute function public.grant_welcome_credits();

-- 7) MEVCUT ÜYELER — bu SQL'i çalıştırdığın anda kayıtlı olan herkese de
--    100 jeton (yalnız satırı olmayanlara; ikinci çalıştırmada tekrar vermez).
insert into public.credits (user_id)
  select id from auth.users
  on conflict (user_id) do nothing;
