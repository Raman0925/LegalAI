import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardClient } from '@/app/dashboard/dashboard-client';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Map user object into a serializable profile representation
  const initialUser = {
    id: user.id,
    email: user.email ?? '',
    user_metadata: user.user_metadata ?? {},
  };

  return <DashboardClient initialUser={initialUser} />;
}
