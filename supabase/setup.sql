-- ═══════════════════════════════════════════════════════════════
-- BARIKAT GYM - DATABASE SETUP
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. PROFILES TABLE
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade primary key,
    full_name text not null default '',
    role text check (role in ('admin', 'member')) default 'member' not null,
    status text check (status in ('active', 'inactive', 'frozen', 'pending', 'expired')) default 'inactive' not null,
    membership_start timestamp with time zone default now(),
    membership_end timestamp with time zone default (now() + interval '30 days'),
    avatar_url text,
    is_inside boolean default false not null,
    freeze_quota integer default 0 not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- ─────────────────────────────────────────────────────────────
-- FREEZE TRACKING COLUMNS (run once to add)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS freeze_start_date timestamptz DEFAULT NULL;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS planned_freeze_days integer DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────
-- PROFILES: User policies (own data only)
-- ─────────────────────────────────────────────────────────────
create policy "Users can view own profile" on public.profiles for
select using (auth.uid () = id);

create policy "Users can update own profile" on public.profiles for
update using (auth.uid () = id);

-- ─────────────────────────────────────────────────────────────
-- PROFILES: Admin policies (all member data)
-- ⚠️ CRITICAL: Without these, admin updates silently fail!
-- ─────────────────────────────────────────────────────────────
create policy "Admins can view all profiles" on public.profiles for
select using (
        exists (
            select 1
            from public.profiles
            where
                id = auth.uid ()
                and role = 'admin'
        )
    );

create policy "Admins can update all profiles" on public.profiles for
update using (
    exists (
        select 1
        from public.profiles
        where
            id = auth.uid ()
            and role = 'admin'
    )
);

create policy "Admins can delete profiles" on public.profiles for delete using (
    exists (
        select 1
        from public.profiles
        where
            id = auth.uid ()
            and role = 'admin'
    )
);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 2. GYM_LOGS TABLE
-- ─────────────────────────────────────────────────────────────
create table if not exists public.gym_logs (
    id uuid default gen_random_uuid () primary key,
    user_id uuid references public.profiles (id) on delete cascade not null,
    entry_time timestamp
    with
        time zone default now () not null,
        exit_time timestamp
    with
        time zone,
        status text check (
            status in ('inside', 'completed')
        ) default 'inside' not null,
        created_at timestamp
    with
        time zone default now ()
);

-- Enable Row Level Security
alter table public.gym_logs enable row level security;

-- Gym logs policies
create policy "Users can view own gym logs" on public.gym_logs for
select using (auth.uid () = user_id);

create policy "Users can insert own gym logs" on public.gym_logs for insert
with
    check (auth.uid () = user_id);

create policy "Users can update own gym logs" on public.gym_logs for
update using (auth.uid () = user_id);

-- Policy for counting active users (anyone authenticated can count)
create policy "Authenticated users can count active entries" on public.gym_logs for
select using (
        auth.role () = 'authenticated'
    );

-- ─────────────────────────────────────────────────────────────
-- GYM_LOGS: Admin policies (manage all entries)
-- ─────────────────────────────────────────────────────────────
create policy "Admins can insert gym logs for any user" on public.gym_logs for insert
with
    check (
        exists (
            select 1
            from public.profiles
            where
                id = auth.uid ()
                and role = 'admin'
        )
    );

create policy "Admins can update any gym log" on public.gym_logs for
update using (
    exists (
        select 1
        from public.profiles
        where
            id = auth.uid ()
            and role = 'admin'
    )
);

create policy "Admins can delete any gym log" on public.gym_logs for delete using (
    exists (
        select 1
        from public.profiles
        where
            id = auth.uid ()
            and role = 'admin'
    )
);

-- ─────────────────────────────────────────────────────────────
-- 3. AUTO CHECK-OUT FUNCTION (3 hours)
-- Run this as a Supabase Edge Function or pg_cron job
-- ─────────────────────────────────────────────────────────────
create or replace function public.auto_checkout()
returns void as $$
begin
  update public.gym_logs
  set
    exit_time = entry_time + interval '3 hours',
    status = 'completed'
  where
    status = 'inside'
    and entry_time < now() - interval '3 hours';
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────
-- 4. INDEXES for performance
-- ─────────────────────────────────────────────────────────────
create index if not exists idx_gym_logs_user_status on public.gym_logs (user_id, status);

create index if not exists idx_gym_logs_status on public.gym_logs (status)
where
    status = 'inside';

create index if not exists idx_gym_logs_entry_time on public.gym_logs (entry_time desc);

-- ─────────────────────────────────────────────────────────────
-- 5. ENABLE REALTIME
-- ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.gym_logs;

alter publication supabase_realtime add table public.profiles;

-- ─────────────────────────────────────────────────────────────
-- 6. NOTIFICATIONS TABLE (Sneak-in Detection / Kaçak Giriş)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.notifications (
    id uuid default gen_random_uuid () primary key,
    user_id uuid references public.profiles (id) on delete cascade not null,
    message text not null,
    is_read boolean default false not null,
    type text default 'alert' not null,
    created_at timestamp
    with
        time zone default now () not null
);

-- Enable Row Level Security
alter table public.notifications enable row level security;

-- ─────────────────────────────────────────────────────────────
-- NOTIFICATIONS: RLS Policies
-- ─────────────────────────────────────────────────────────────

-- Users can insert their own notifications (sneak detection runs in their session)
create policy "Users can insert own notifications" on public.notifications for insert
with
    check (auth.uid () = user_id);

-- Users can view their own notifications
create policy "Users can view own notifications" on public.notifications for
select using (auth.uid () = user_id);

-- Admins can view ALL notifications
create policy "Admins can view all notifications" on public.notifications for
select using (
        exists (
            select 1
            from public.profiles
            where
                id = auth.uid ()
                and role = 'admin'
        )
    );

-- Admins can update all notifications (mark as read)
create policy "Admins can update all notifications" on public.notifications for
update using (
    exists (
        select 1
        from public.profiles
        where
            id = auth.uid ()
            and role = 'admin'
    )
);

-- Admins can delete notifications
create policy "Admins can delete all notifications" on public.notifications for delete using (
    exists (
        select 1
        from public.profiles
        where
            id = auth.uid ()
            and role = 'admin'
    )
);

-- ─────────────────────────────────────────────────────────────
-- NOTIFICATIONS: Indexes
-- ─────────────────────────────────────────────────────────────
create index if not exists idx_notifications_user_type
on public.notifications (user_id, type);

create index if not exists idx_notifications_is_read on public.notifications (is_read)
where
    is_read = false;

create index if not exists idx_notifications_created_at on public.notifications (created_at desc);

-- ─────────────────────────────────────────────────────────────
-- NOTIFICATIONS: Enable Realtime
-- ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.notifications;

-- ─────────────────────────────────────────────────────────────
-- 7. ADMIN_INVITES TABLE (Admin davet kodu sistemi)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.admin_invites (
    id uuid default gen_random_uuid() primary key,
    code text not null unique,
    is_used boolean default false not null,
    used_by uuid references public.profiles(id) on delete set null,
    created_at timestamp with time zone default now() not null
);

-- Enable Row Level Security
alter table public.admin_invites enable row level security;

-- Anyone can check if a code is valid (needed during signup, before user is authenticated)
create policy "Anyone can read invite codes" on public.admin_invites for
select using (true);

-- Only admins can insert new invite codes
create policy "Admins can insert invite codes" on public.admin_invites for insert
with check (
    exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    )
);

-- Anyone authenticated can update (mark as used during signup flow)
create policy "Authenticated users can use invite codes" on public.admin_invites for
update using (auth.role() = 'authenticated');

-- Only admins can delete invite codes
create policy "Admins can delete invite codes" on public.admin_invites for delete using (
    exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    )
);

-- Index for fast code lookup
create index if not exists idx_admin_invites_code on public.admin_invites (code);
create index if not exists idx_admin_invites_is_used on public.admin_invites (is_used) where is_used = false;

-- ─────────────────────────────────────────────────────────────
-- 8. STORAGE: avatars bucket
-- Not: Bu SQL'i çalıştırmadan önce Supabase Dashboard > Storage'dan
--      "avatars" adında public bir bucket oluşturun.
--      Ardından aşağıdaki RLS politikalarını ekleyin.
-- ─────────────────────────────────────────────────────────────

-- Kullanıcılar kendi avatar klasörüne upload edebilir
create policy "Users can upload own avatar"
on storage.objects for insert
with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
);

-- Herkes avatarları görebilir (public bucket)
create policy "Anyone can view avatars"
on storage.objects for select
using (bucket_id = 'avatars');

-- Kullanıcılar kendi avatarlarını güncelleyebilir/silebilir
create policy "Users can update own avatar"
on storage.objects for update
using (bucket_id = 'avatars' and auth.uid() is not null);

create policy "Users can delete own avatar"
on storage.objects for delete
using (bucket_id = 'avatars' and auth.uid() is not null);

-- ═══════════════════════════════════════════════════════════════
-- DONE! Your database is ready.
-- ═══════════════════════════════════════════════════════════════