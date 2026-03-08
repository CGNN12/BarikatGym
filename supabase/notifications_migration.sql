-- ═══════════════════════════════════════════════════════════════
-- BARIKAT GYM — NOTIFICATIONS TABLE MIGRATION
-- Kaçak Giriş / Sneak-in Detection için bildirim tablosu
--
-- Bu SQL'i Supabase Dashboard > SQL Editor'de çalıştırın.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. NOTIFICATIONS TABLOSU
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
-- 2. RLS POLİTİKALARI
-- ─────────────────────────────────────────────────────────────

-- Üyeler kendi bildirimlerini yazabilir (arka plan task kendi oturumlarında çalışır)
create policy "Users can insert own notifications" on public.notifications for insert
with
    check (auth.uid () = user_id);

-- Üyeler kendi bildirimlerini görebilir
create policy "Users can view own notifications" on public.notifications for
select using (auth.uid () = user_id);

-- Adminler TÜM bildirimleri görebilir
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

-- Adminler tüm bildirimleri güncelleyebilir (okundu olarak işaretleme)
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

-- Adminler bildirimleri silebilir
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
-- 3. İNDEXLER (Performans)
-- ─────────────────────────────────────────────────────────────
create index if not exists idx_notifications_user_type
on public.notifications (user_id, type);

create index if not exists idx_notifications_is_read on public.notifications (is_read)
where
    is_read = false;

create index if not exists idx_notifications_created_at on public.notifications (created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 4. REALTIME
-- ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.notifications;

-- ═══════════════════════════════════════════════════════════════
-- TAMAMLANDI! Notifications tablosu hazır.
-- ═══════════════════════════════════════════════════════════════