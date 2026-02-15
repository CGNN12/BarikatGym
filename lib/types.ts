export interface Profile {
  id: string;
  full_name: string;
  membership_start: string;
  membership_end: string;
  avatar_url: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GymLog {
  id: string;
  user_id: string;
  entry_time: string;
  exit_time: string | null;
  status: "inside" | "completed";
  created_at?: string;
}

export interface ActiveSession {
  id: string;
  user_id: string;
  entry_time: string;
  status: "inside";
}

export type AuthUser = {
  id: string;
  email: string;
};

export type MembershipStatus = "active" | "expiring_soon" | "expired";

export interface DashboardStats {
  activeCount: number;
  currentSession: GymLog | null;
  membershipDaysLeft: number;
  membershipStatus: MembershipStatus;
}
