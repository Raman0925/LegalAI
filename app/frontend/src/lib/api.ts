import { createBrowserClient } from '@/lib/supabase/client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = createBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No active session');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function get<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// For POST endpoints that return 204 No Content (e.g. attachDocument)
// Using post<T> on a 204 would call res.json() on an empty body and throw.
async function postEmpty(path: string, body: unknown): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function del(path: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
}

// Uses XHR (not fetch) so upload progress can be reported via xhr.upload.onprogress.
async function uploadFile<T>(
  path: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<T> {
  const supabase = createBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No active session');

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);

    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText ? JSON.parse(xhr.responseText) : (undefined as T));
      } else {
        reject(new Error(`API error ${xhr.status}: ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));

    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
}

async function download(path: string, filename: string): Promise<void> {
  const supabase = createBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No active session');

  const res = await fetch(`${API_BASE}${path}`, {
    // No Content-Type on GET — only send auth header
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw new Error(`Download error ${res.status}: ${await res.text()}`);
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export interface DocumentRecord {
  id: string;
  name: string;
  fileType: 'pdf' | 'docx' | 'txt' | 'image';
  sizeBytes: number | null;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  chunkCount: number;
  errorMsg: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentStatusResponse {
  status: DocumentRecord['status'];
  chunkCount: number;
  errorMsg: string | null;
}

export interface MatterRecord {
  id: string;
  userId: string;
  title: string;
  clientName: string | null;
  matterType: 'general' | 'contract' | 'litigation' | 'advisory' | 'compliance';
  status: 'open' | 'in_progress' | 'closed' | 'archived';
  description: string | null;
  documentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MatterClause {
  id: string;
  matterId: string;
  documentId: string;
  clauseType: string;
  content: string;
  riskLevel: 'high' | 'medium' | 'low' | null;
  createdAt: string;
}

export interface MatterDraft {
  id: string;
  matterId: string;
  title: string;
  content: string;
  draftType: 'contract' | 'letter' | 'memo' | 'clause';
  createdAt: string;
  updatedAt: string;
}

export interface MatterWithDetails extends MatterRecord {
  attachedDocuments: DocumentRecord[];
  clauses: MatterClause[];
  drafts: MatterDraft[];
}

// Typed API methods — extend as new backend routes are added
export const api = {
  auth: {
    me: () =>
      get<{
        id: string;
        email: string;
        full_name: string | null;
        avatar_url: string | null;
        created_at: string;
        updated_at: string;
      }>('/auth/me'),
    updateProfile: (body: { full_name?: string | null; avatar_url?: string | null }) =>
      put<{
        id: string;
        email: string;
        full_name: string | null;
        avatar_url: string | null;
        updated_at: string;
      }>('/auth/me', body),
  },
  chat: {
    send: (message: string, history: { role: string; content: string }[], tier?: string) =>
      post<{ text: string; usage: { inputTokens: number; outputTokens: number } }>('/chat', {
        message,
        history,
        tier,
      }),
  },
  documents: {
    list: () => get<DocumentRecord[]>('/documents'),
    getById: (id: string) => get<DocumentRecord>(`/documents/${id}`),
    getStatus: (id: string) => get<DocumentStatusResponse>(`/documents/${id}/status`),
    remove: (id: string) => del(`/documents/${id}`),
    upload: (file: File, onProgress?: (percent: number) => void) =>
      uploadFile<{ documentId: string; status: 'pending' }>('/documents/upload', file, onProgress),
  },
  matters: {
    list: () => get<MatterRecord[]>('/matters'),
    getById: (id: string) => get<MatterWithDetails>(`/matters/${id}`),
    create: (body: {
      title: string;
      clientName: string | null;
      matterType: string;
      description: string | null;
      status?: string;
    }) => post<MatterRecord>('/matters', body),
    update: (
      id: string,
      body: {
        title?: string;
        clientName?: string | null;
        matterType?: string;
        description?: string | null;
        status?: string;
      },
    ) => patch<MatterRecord>(`/matters/${id}`, body),
    remove: (id: string) => del(`/matters/${id}`),
    // attachDocument backend returns 200 { success: true }
    attachDocument: (id: string, documentId: string) =>
      post<{ success: boolean }>(`/matters/${id}/documents`, { documentId }),
    detachDocument: (id: string, docId: string) => del(`/matters/${id}/documents/${docId}`),
    extractClauses: (id: string) => post<MatterClause[]>(`/matters/${id}/extract-clauses`, {}),
    createDraft: (id: string, body: { title: string; draftType: string; instructions: string }) =>
      post<MatterDraft>(`/matters/${id}/drafts`, body),
    deleteDraft: (id: string, draftId: string) => del(`/matters/${id}/drafts/${draftId}`),
    exportPdf: (id: string, title: string) =>
      download(`/matters/${id}/export/pdf`, `matter-${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`),
    exportDocx: (id: string, title: string) =>
      download(`/matters/${id}/export/docx`, `matter-${title.replace(/[^a-zA-Z0-9]/g, '_')}.docx`),
  },
};
