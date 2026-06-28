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

  const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
  
  // Reconstruct full query string for the backend request
  const backendParams = new URLSearchParams(searchParams);
  backendParams.delete('path'); // remove 'path' parameter
  const queryString = backendParams.toString();
  const url = `${backendUrl}${path}${queryString ? `?${queryString}` : ''}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    // Keep useful headers, avoid overriding host
    if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
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

    // Otherwise return standard response
    const resHeaders = new Headers();
    res.headers.forEach((value, key) => {
      if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
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
