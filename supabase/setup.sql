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
    membership_start timestamp
    with
        time zone default now (),
        membership_end timestamp
    with
        time zone default (now () + interval '30 days'),
        avatar_url text,
        created_at timestamp
    with
        time zone default now (),
        updated_at timestamp
    with
        time zone default now ()
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

-- ═══════════════════════════════════════════════════════════════
-- DONE! Your database is ready.
-- ═══════════════════════════════════════════════════════════════