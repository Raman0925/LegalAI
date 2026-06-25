import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MatterDetailClient } from './matter-detail-client';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MatterDetailPage({ params }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { id } = await params;

  const initialUser = {
    id: user.id,
    email: user.email ?? '',
    user_metadata: user.user_metadata ?? {},
  };

  return <MatterDetailClient id={id} initialUser={initialUser} />;
}
