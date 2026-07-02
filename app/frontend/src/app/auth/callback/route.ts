import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const inviteToken = searchParams.get('invite');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(`${origin}/login?error=no_user`);
    }

    // Check if user already has a firm in our profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id')
      .eq('id', user.id)
      .single();

    // Flow 1: Joining via invite link
    if (inviteToken) {
      return NextResponse.redirect(`${origin}/join?token=${inviteToken}`);
    }

    // Flow 2: Already in a firm → go straight to dashboard
    if (profile?.firm_id) {
      return NextResponse.redirect(`${origin}/dashboard`);
    }

    // Flow 3: New user with no firm → must set up firm first
    return NextResponse.redirect(`${origin}/onboarding`);
  } catch {
    return NextResponse.redirect(`${origin}/login?error=auth-code-error`);
  }
}
