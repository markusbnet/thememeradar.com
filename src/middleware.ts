import { NextRequest, NextResponse } from 'next/server';

function base64UrlDecode(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const buf = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function verifyJWT(token: string): Promise<{ userId: string } | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret || !token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const encoder = new TextEncoder();

    // Import the HMAC-SHA256 key
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Verify the signature against header.payload.
    // Pass Uint8Array directly — the Edge Runtime's SubtleCrypto rejects
    // .buffer (ArrayBuffer from a different V8 realm) but accepts TypedArray.
    const signatureInput = encoder.encode(`${parts[0]}.${parts[1]}`) as Uint8Array<ArrayBuffer>;
    const signature = base64UrlDecode(parts[2]);

    const valid = await crypto.subtle.verify('HMAC', key, signature, signatureInput);
    if (!valid) return null;

    // Signature verified — now decode the payload.
    // Must add padding before atob: Edge Runtime's atob is strict about it.
    const b64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = b64Payload + '='.repeat((4 - b64Payload.length % 4) % 4);
    const payload = JSON.parse(atob(paddedPayload));

    if (!payload.userId || typeof payload.userId !== 'string') return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const cookieName = process.env.SESSION_COOKIE_NAME || 'meme_radar_session';
  const token = request.cookies.get(cookieName)?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/stock/:path*'],
};
