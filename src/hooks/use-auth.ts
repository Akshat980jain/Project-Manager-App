import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type AuthState = {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
};

let listeners: Array<(s: AuthState) => void> = [];
let state: AuthState = { session: null, user: null, isAdmin: false, loading: true };
let initialized = false;

function emit() { listeners.forEach((l) => l(state)); }

async function refreshRole(userId: string | null) {
  if (!userId) {
    state = { ...state, isAdmin: false };
    return;
  }
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  state = { ...state, isAdmin: !!data?.some((r) => r.role === "admin") };
}

function init() {
  if (initialized) return;
  initialized = true;

  supabase.auth.onAuthStateChange(async (_e, session) => {
    state = { ...state, session, user: session?.user ?? null, loading: false };
    emit();
    await refreshRole(session?.user?.id ?? null);
    emit();
  });

  supabase.auth.getSession().then(async ({ data }) => {
    state = { ...state, session: data.session, user: data.session?.user ?? null, loading: false };
    emit();
    await refreshRole(data.session?.user?.id ?? null);
    emit();
  });
}

export function useAuth(): AuthState {
  const [s, setS] = useState<AuthState>(state);
  useEffect(() => {
    init();
    listeners.push(setS);
    setS(state);
    return () => {
      listeners = listeners.filter((l) => l !== setS);
    };
  }, []);
  return s;
}

export async function signOut() {
  await supabase.auth.signOut();
}
