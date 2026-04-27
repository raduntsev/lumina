// src/hooks/useSpaceAuth.ts
// Lumina — Authentication & Space Linking Logic
// "Secret Link" invitation flow: no passwords, no friction.

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  space_id: string | null;
  display_name: string;
  avatar_url: string | null;
  total_balance: number;
}

interface SpaceAuthState {
  user:        User | null;
  session:     Session | null;
  profile:     Profile | null;
  spaceId:     string | null;
  inviteCode:  string | null;
  isLoading:   boolean;
  error:       string | null;
}

// ── Public hook ──────────────────────────────────────────────────────────────

export function useSpaceAuth() {
  const router = useRouter();
  const [state, setState] = useState<SpaceAuthState>({
    user:       null,
    session:    null,
    profile:    null,
    spaceId:    null,
    inviteCode: null,
    isLoading:  true,
    error:      null,
  });

  // Load session + profile on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (mounted) {
          setState(s => ({
            ...s,
            user:      session.user,
            session,
            profile,
            spaceId:   profile?.space_id ?? null,
            isLoading: false,
          }));
        }
      } else {
        if (mounted) setState(s => ({ ...s, isLoading: false }));
      }
    };

    init();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setState(s => ({
            ...s,
            user:      session.user,
            session,
            profile,
            spaceId:   profile?.space_id ?? null,
            isLoading: false,
            error:     null,
          }));

        } else {
          setState(s => ({ ...s, user: null, session: null, profile: null, spaceId: null, isLoading: false }));
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  // ── STEP 1: Send magic link to email ─────────────────────────────────────

  const sendMagicLink = useCallback(async (email: string) => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    setState(s => ({ ...s, isLoading: false, error: error?.message ?? null }));
    return !error;
  }, []);

  // ── STEP 2 (Creator): Create a new space and get invite code ─────────────

  const createSpace = useCallback(async (spaceName?: string) => {
    if (!state.user) return null;
    setState(s => ({ ...s, isLoading: true, error: null }));

    // Create the space
    const { data: space, error: spaceError } = await supabase
      .from('spaces')
      .insert({ name: spaceName ?? 'Our Space' })
      .select()
      .single();

    if (spaceError) {
      setState(s => ({ ...s, isLoading: false, error: spaceError.message }));
      return null;
    }

    // Bind creator's profile to this space
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ space_id: space.id })
      .eq('id', state.user.id);

    if (profileError) {
      setState(s => ({ ...s, isLoading: false, error: profileError.message }));
      return null;
    }

    // Initialize wallet for the space
    await supabase.from('wallet').insert({ space_id: space.id, balance: 0 });

    setState(s => ({
      ...s,
      spaceId:    space.id,
      inviteCode: space.invite_code,
      isLoading:  false,
    }));

    return space;
  }, [state.user]);

  // ── STEP 2 (Partner): Join a space via invite code ───────────────────────

  const joinSpace = useCallback(async (inviteCode: string) => {
    if (!state.user) return false;
    setState(s => ({ ...s, isLoading: true, error: null }));

    // Find the space
    const { data: space, error: findError } = await supabase
      .from('spaces')
      .select('id, invite_code')
      .eq('invite_code', inviteCode.trim().toLowerCase())
      .single();

    if (findError || !space) {
      setState(s => ({
        ...s,
        isLoading: false,
        error: 'Invite code not found. Check the link and try again.',
      }));
      return false;
    }

    // Verify space doesn't already have 2 members
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('space_id', space.id);

    if ((count ?? 0) >= 2) {
      setState(s => ({
        ...s,
        isLoading: false,
        error: 'This space is already full (2 partners maximum).',
      }));
      return false;
    }

    // Bind partner to this space
    const { error: joinError } = await supabase
      .from('profiles')
      .update({ space_id: space.id })
      .eq('id', state.user!.id);

    if (joinError) {
      setState(s => ({ ...s, isLoading: false, error: joinError.message }));
      return false;
    }

    setState(s => ({ ...s, spaceId: space.id, isLoading: false }));
    return true;
  }, [state.user]);

  // ── Update display name ───────────────────────────────────────────────────

  const updateDisplayName = useCallback(async (name: string) => {
    if (!state.user) return;
    await supabase.from('profiles').update({ display_name: name }).eq('id', state.user.id);
    setState(s => ({
      ...s,
      profile: s.profile ? { ...s.profile, display_name: name } : null,
    }));
  }, [state.user]);

  // ── Sign out ──────────────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ user: null, session: null, profile: null, spaceId: null, inviteCode: null, isLoading: false, error: null });
    router.push('/');
  }, [router]);

  // ── Generate shareable invite URL ────────────────────────────────────────

  const getInviteUrl = useCallback(() => {
    const code = state.inviteCode ?? state.profile?.space_id;
    if (!code) return null;
    return `${window.location.origin}/join/${code}`;
  }, [state.inviteCode, state.profile?.space_id]);

  return {
    ...state,
    sendMagicLink,
    createSpace,
    joinSpace,
    updateDisplayName,
    signOut,
    getInviteUrl,
    isAuthenticated: !!state.user,
    hasSpace:        !!state.spaceId,
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, space_id, display_name, avatar_url, total_balance')
    .eq('id', userId)
    .single();
  return data;
}
