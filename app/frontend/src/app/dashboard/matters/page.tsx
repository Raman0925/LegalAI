import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MattersClient } from './matters-client';

export default async function MattersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const initialUser = {
    id: user.id,
    email: user.email ?? '',
    user_metadata: user.user_metadata ?? {},
  };

  return <MattersClient initialUser={initialUser} />;
}
