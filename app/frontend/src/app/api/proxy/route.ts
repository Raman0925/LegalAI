import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return handleProxy(request);
}

export async function POST(request: NextRequest) {
  return handleProxy(request);
}

export async function PUT(request: NextRequest) {
  return handleProxy(request);
}

export async function DELETE(request: NextRequest) {
  return handleProxy(request);
}

export async function PATCH(request: NextRequest) {
  return handleProxy(request);
}

async function handleProxy(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
  }

  // 1. Path sanitization and allowlist validation
  if (!path.startsWith('/') || path.includes('..')) {
    return NextResponse.json({ error: 'Invalid path format' }, { status: 400 });
  }

  const allowedPrefixes = ['/editor', '/contracts', '/matters', '/onboarding', '/billing'];
  const isAllowed = allowedPrefixes.some(prefix => path.startsWith(prefix));
  if (!isAllowed) {
    return NextResponse.json({ error: 'Access denied to this API resource' }, { status: 403 });
  }

  // 2. Authentication validation
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader === 'Bearer null') {
    return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
  
  // Reconstruct full query string for the backend request
  const backendParams = new URLSearchParams(searchParams);
  backendParams.delete('path'); // remove 'path' parameter
  const queryString = backendParams.toString();
  const url = `${backendUrl}${path}${queryString ? `?${queryString}` : ''}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    // Keep useful headers, avoid overriding host/cookies/sensitive params
    const lowerKey = key.toLowerCase();
    if (['authorization', 'content-type', 'accept', 'accept-encoding'].includes(lowerKey)) {
      headers.set(key, value);
    }
  });

  const method = request.method;
  let body: any = null;

  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      // Forward form data
      body = await request.formData();
    } else {
      // Forward JSON/text
      body = await request.text();
    }
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? (body instanceof FormData ? body : body) : undefined,
      cache: 'no-store',
    });

    // Check if it's SSE stream
    const responseContentType = res.headers.get('content-type') || '';
    if (responseContentType.includes('text/event-stream')) {
      // Return a ReadableStream for event-stream
      const { readable, writable } = new TransformStream();
      res.body?.pipeTo(writable);
      return new NextResponse(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Otherwise return standard response, filtering headers
    const resHeaders = new Headers();
    const allowedResHeaders = [
      'content-type',
      'content-length',
      'cache-control',
      'connection',
      'content-disposition'
    ];
    res.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (allowedResHeaders.includes(lowerKey)) {
        resHeaders.set(key, value);
      }
    });

    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders,
    });
  } catch (err: any) {
    console.error(`Proxy request failed to ${url}:`, err);
    return NextResponse.json(
      { error: `Proxy request failed: ${err.message}` },
      { status: 500 }
    );
  }
}
