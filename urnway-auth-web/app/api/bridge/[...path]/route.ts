import { NextRequest, NextResponse } from 'next/server';

function normalizeTargetBaseUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().replace(/\/+$/, '');

  if (!trimmed || trimmed.startsWith('/')) {
    return null;
  }

  try {
    return new URL(trimmed).toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function buildTargetUrl(pathSegments: string[]) {
  const baseUrl = normalizeTargetBaseUrl(
    process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_TARGET_URL
  );

  if (!baseUrl) {
    throw new Error(
      'API_BASE_URL or NEXT_PUBLIC_API_TARGET_URL must be configured for the auth-web bridge.'
    );
  }

  const suffix = pathSegments.join('/');
  return `${baseUrl}/${suffix}`;
}

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    const targetUrl = new URL(buildTargetUrl(path));

    request.nextUrl.searchParams.forEach((value, key) => {
      targetUrl.searchParams.append(key, value);
    });

    const headers = new Headers();
    const contentType = request.headers.get('content-type');
    const accept = request.headers.get('accept');

    if (contentType) {
      headers.set('content-type', contentType);
    }

    if (accept) {
      headers.set('accept', accept);
    }

    const hasBody = !['GET', 'HEAD'].includes(request.method);
    const body = hasBody ? await request.text() : undefined;

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
    });

    const responseHeaders = new Headers();
    const responseContentType = response.headers.get('content-type');

    if (responseContentType) {
      responseHeaders.set('content-type', responseContentType);
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'The auth-web API bridge failed unexpectedly.',
        },
      },
      { status: 502 }
    );
  }
}

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handle(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handle(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handle(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handle(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handle(request, context);
}
