import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  full_name: string;
  role: "client" | "freelancer" | null;
  headline: string;
  bio: string;
  skills: string[];
  hourly_rate: number | null;
  created_at: string;
};

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return null;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile((data as Profile) ?? null);
    return (data as Profile) ?? null;
  }, [userId]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  return {
    session,
    user: (session?.user ?? null) as User | null,
    userId,
    profile,
    loading,
    refreshProfile,
    setProfile,
  };
}

export const SKILL_OPTIONS = [
  "Web Development",
  "Mobile Apps",
  "UI/UX Design",
  "Graphic Design",
  "Branding",
  "Content Writing",
  "Copywriting",
  "SEO",
  "Social Media",
  "Video Editing",
  "Motion Graphics",
  "Photography",
  "Data Analysis",
  "Machine Learning",
  "DevOps",
  "Translation",
  "Voice Over",
  "Illustration",
];

export function matchScore(needed: string[], has: string[]) {
  if (!needed?.length) return 0;
  const set = new Set(has ?? []);
  const hits = needed.filter((s) => set.has(s)).length;
  return Math.round((hits / needed.length) * 100);
}
