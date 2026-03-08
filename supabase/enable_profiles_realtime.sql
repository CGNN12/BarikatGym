-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Enable Realtime on profiles table
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)
--
-- This is required for the member dashboard and scan screen to
-- receive instant status updates when admin freezes/activates
-- a member's account.
-- ═══════════════════════════════════════════════════════════════

-- Add profiles table to the realtime publication
-- (gym_logs and notifications are already added)
alter publication supabase_realtime add table public.profiles;