-- Kitap Stüdyosu — çoklu proje (Projelerim) altyapısı.
-- Supabase panelinde SQL editor'e yapıştırıp BİR KEZ çalıştır.

-- 1) PROJECTS TABLOSU
create extension if not exists pgcrypto;

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default '',          -- liste için (envelope.meta'dan türetilir)
  author      text not null default '',
  thumb_path  text,                               -- thumb.jpg storage yolu (boş olabilir)
  data        jsonb not null default '{}'::jsonb, -- envelope: { schema, meta, manuscript, modules, cover }
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- user_id'yi unutmaya karşı güvenlik: insert'te varsayılan = giriş yapan kullanıcı
alter table public.projects alter column user_id set default auth.uid();

create index if not exists projects_user_updated_idx
  on public.projects (user_id, updated_at desc);

-- her yazımda updated_at tazelensin
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- 2) ROW LEVEL SECURITY (yalnız sahibi görür/değiştirir)
alter table public.projects enable row level security;

drop policy if exists "projects own select" on public.projects;
create policy "projects own select" on public.projects
  for select to authenticated using ( (select auth.uid()) = user_id );

drop policy if exists "projects own insert" on public.projects;
create policy "projects own insert" on public.projects
  for insert to authenticated with check ( (select auth.uid()) = user_id );

drop policy if exists "projects own update" on public.projects;
create policy "projects own update" on public.projects
  for update to authenticated using ( (select auth.uid()) = user_id )
                                with check ( (select auth.uid()) = user_id );

drop policy if exists "projects own delete" on public.projects;
create policy "projects own delete" on public.projects
  for delete to authenticated using ( (select auth.uid()) = user_id );

-- 3) STORAGE KOVASI (özel — kapak görselleri)
insert into storage.buckets (id, name, public)
values ('cover-images', 'cover-images', false)
on conflict (id) do nothing;

-- 4) STORAGE.OBJECTS POLİTİKALARI (yol: <user_id>/<project_id>/...; ilk klasör = kullanıcı id)
drop policy if exists "cover own read" on storage.objects;
create policy "cover own read" on storage.objects
  for select to authenticated
  using ( bucket_id = 'cover-images' and (storage.foldername(name))[1] = (select auth.uid())::text );

drop policy if exists "cover own insert" on storage.objects;
create policy "cover own insert" on storage.objects
  for insert to authenticated
  with check ( bucket_id = 'cover-images' and (storage.foldername(name))[1] = (select auth.uid())::text );

drop policy if exists "cover own update" on storage.objects;
create policy "cover own update" on storage.objects
  for update to authenticated
  using ( bucket_id = 'cover-images' and (storage.foldername(name))[1] = (select auth.uid())::text )
  with check ( bucket_id = 'cover-images' and (storage.foldername(name))[1] = (select auth.uid())::text );

drop policy if exists "cover own delete" on storage.objects;
create policy "cover own delete" on storage.objects
  for delete to authenticated
  using ( bucket_id = 'cover-images' and (storage.foldername(name))[1] = (select auth.uid())::text );
-- Not: upsert:true yüklemeleri SELECT + INSERT + UPDATE politikalarının üçünün de geçmesini gerektirir.
