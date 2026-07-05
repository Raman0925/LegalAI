import { SupabaseClient } from '@supabase/supabase-js';

export async function getOrCreateActiveSession(
  supabase: SupabaseClient,
  firmId: string,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('firm_id', firmId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.id) {
    return data.id;
  }

  const { data: newSession, error: createError } = await supabase
    .from('chat_sessions')
    .insert({
      firm_id: firmId,
      user_id: userId,
      title: 'Active Chat Session',
    })
    .select('id')
    .single();

  if (createError || !newSession) {
    throw new Error(`Failed to create chat session: ${createError?.message}`);
  }

  return newSession.id;
}

export async function getMessages(
  supabase: SupabaseClient,
  sessionId: string,
  firmId: string
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  // Verify session ownership
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('firm_id', firmId)
    .single();

  if (!session) {
    throw new Error('Forbidden: Chat session not found or access denied');
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch chat messages: ${error.message}`);
  return (data || []) as any;
}

export async function saveMessage(
  supabase: SupabaseClient,
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  const { error } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      role,
      content,
    });

  if (error) throw new Error(`Failed to save chat message: ${error.message}`);

  // Update session updated_at
  await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);
}
