import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  computeImageMimeType,
  handleImageProxyRequest,
  IMAGE_PROXY_MAX_BYTES,
  IMAGE_PROXY_ORIGIN,
  IMAGE_PROXY_PATH,
  proxiedImageUrl,
  signImageUrl,
  verifyImageUrlSignature,
} from '../src/utils/imageProxy';

/**
 * Tests for the signed image proxy (src/utils/imageProxy.ts)
 */

const KEY = 'test-image-proxy-key-0123456789abcdef';
const IMAGE = 'https://images.example.com/market/1.png';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const GIF = new TextEncoder().encode('GIF89a\x01\x00\x01\x00');
const WEBP = new TextEncoder().encode('RIFF\x24\x00\x00\x00WEBPVP8 ');

function proxyRequestUrl(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `${IMAGE_PROXY_ORIGIN}${IMAGE_PROXY_PATH}?${qs}`;
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function upstream(body: Uint8Array | string, contentType?: string, extra: Record<string, string> = {}): Response {
  const headers: Record<string, string> = { ...extra };
  if (contentType !== undefined) headers['content-type'] = contentType;
  return new Response(body, { headers });
}

async function proxy(response: Response): Promise<Response> {
  stubFetch(response);
  const sig = await signImageUrl(IMAGE, KEY);
  return handleImageProxyRequest(proxyRequestUrl({ url: IMAGE, sig }), KEY);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('signImageUrl / verifyImageUrlSignature', () => {
  it('verifies its own signature', async () => {
    const sig = await signImageUrl(IMAGE, KEY);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyImageUrlSignature(IMAGE, sig, KEY)).toBe(true);
  });

  it('rejects a different URL, a different key, and malformed signatures', async () => {
    const sig = await signImageUrl(IMAGE, KEY);
    expect(await verifyImageUrlSignature(`${IMAGE}?x=1`, sig, KEY)).toBe(false);
    expect(await verifyImageUrlSignature(IMAGE, sig, `${KEY}-other`)).toBe(false);
    expect(await verifyImageUrlSignature(IMAGE, sig.slice(0, 63), KEY)).toBe(false);
    expect(await verifyImageUrlSignature(IMAGE, sig.toUpperCase(), KEY)).toBe(false);
    expect(await verifyImageUrlSignature(IMAGE, '', KEY)).toBe(false);
  });
});

describe('proxiedImageUrl', () => {
  it('returns a signed proxy URL that verifies', async () => {
    const proxied = await proxiedImageUrl(IMAGE, KEY);
    expect(proxied).toBeDefined();
    const url = new URL(proxied as string);
    expect(url.origin).toBe(IMAGE_PROXY_ORIGIN);
    expect(url.pathname).toBe(IMAGE_PROXY_PATH);
    expect(url.searchParams.get('url')).toBe(IMAGE);
    expect(
      await verifyImageUrlSignature(url.searchParams.get('url') as string, url.searchParams.get('sig') as string, KEY),
    ).toBe(true);
  });

  it('returns undefined without an image, without a usable key, or for non-http URLs', async () => {
    expect(await proxiedImageUrl(undefined, KEY)).toBeUndefined();
    expect(await proxiedImageUrl('', KEY)).toBeUndefined();
    expect(await proxiedImageUrl(IMAGE, undefined)).toBeUndefined();
    expect(await proxiedImageUrl(IMAGE, 'too-short-key')).toBeUndefined();
    expect(await proxiedImageUrl('javascript:alert(1)', KEY)).toBeUndefined();
    expect(await proxiedImageUrl('data:image/png;base64,AAAA', KEY)).toBeUndefined();
    expect(await proxiedImageUrl('not a url', KEY)).toBeUndefined();
  });

  it('signs the normalised URL', async () => {
    const proxied = await proxiedImageUrl('https://Images.Example.com/a b.png', KEY);
    expect(new URL(proxied as string).searchParams.get('url')).toBe('https://images.example.com/a%20b.png');
  });
});

describe('computeImageMimeType (WHATWG MIME Sniffing, image context)', () => {
  it('uses the image type pattern table over the supplied type', () => {
    expect(computeImageMimeType('image/jpg', JPEG)).toBe('image/jpeg');
    expect(computeImageMimeType('binary/octet-stream', PNG)).toBe('image/png');
    expect(computeImageMimeType('', GIF)).toBe('image/gif');
    expect(computeImageMimeType('application/octet-stream', WEBP)).toBe('image/webp');
    expect(computeImageMimeType('', new Uint8Array([0x42, 0x4d, 0, 0]))).toBe('image/bmp');
    expect(computeImageMimeType('', new Uint8Array([0, 0, 1, 0, 1, 0]))).toBe('image/x-icon');
  });

  it('keeps the supplied type when no pattern matches, and never sniffs XML types', () => {
    expect(computeImageMimeType('image/avif', new Uint8Array([0, 0, 0, 0x1c, 0x66, 0x74]))).toBe('image/avif');
    expect(computeImageMimeType('', new Uint8Array([1, 2, 3]))).toBe('');
    expect(computeImageMimeType('image/svg+xml', PNG)).toBe('image/svg+xml');
  });
});

describe('handleImageProxyRequest', () => {
  it('refuses requests without a usable key, signature, or valid signature, without fetching', async () => {
    const fetchMock = stubFetch(new Response('x'));
    const sig = await signImageUrl(IMAGE, KEY);
    const shortKey = 'too-short-key';
    const shortSig = await signImageUrl(IMAGE, shortKey);
    const cases = [
      { url: proxyRequestUrl({ url: IMAGE, sig }), key: undefined },
      { url: proxyRequestUrl({ url: IMAGE, sig: shortSig }), key: shortKey },
      { url: proxyRequestUrl({ url: IMAGE }), key: KEY },
      { url: proxyRequestUrl({ url: IMAGE, sig: '0'.repeat(64) }), key: KEY },
      { url: proxyRequestUrl({ url: 'https://attacker.example/page.html', sig }), key: KEY },
      { url: proxyRequestUrl({ sig }), key: KEY },
    ];
    for (const c of cases) {
      const res = await handleImageProxyRequest(c.url, c.key);
      expect(res.status).toBe(403);
      expect(res.headers.get('content-type')).toContain('text/plain');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves a signed image with safe headers', async () => {
    const res = await proxy(upstream(PNG, 'image/png; charset=binary'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toContain('sandbox');
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
  });

  it('serves mislabelled or unlabelled raster images under their sniffed type', async () => {
    let res = await proxy(upstream(JPEG, 'image/jpg'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG);

    res = await proxy(upstream(PNG, 'binary/octet-stream'));
    expect(res.headers.get('content-type')).toBe('image/png');

    res = await proxy(upstream(GIF));
    expect(res.headers.get('content-type')).toBe('image/gif');
  });

  it('serves an HTML body labelled as an image only as that image type, with nosniff', async () => {
    const res = await proxy(upstream('<html><script>alert(1)</script></html>', 'image/png'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('refuses SVG, non-image content, unknown bytes, upstream errors, oversized and failed fetches', async () => {
    expect((await proxy(upstream('<svg xmlns="http://www.w3.org/2000/svg"/>', 'image/svg+xml'))).status).toBe(502);
    expect((await proxy(upstream('<script>alert(1)</script>', 'text/html'))).status).toBe(502);
    expect((await proxy(upstream(new Uint8Array([1, 2, 3, 4])))).status).toBe(502);
    expect((await proxy(new Response('nope', { status: 404, headers: { 'content-type': 'image/png' } }))).status).toBe(502);
    expect(
      (await proxy(upstream(PNG, 'image/png', { 'content-length': String(IMAGE_PROXY_MAX_BYTES + 1) }))).status,
    ).toBe(502);

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const sig = await signImageUrl(IMAGE, KEY);
    const failed = await handleImageProxyRequest(proxyRequestUrl({ url: IMAGE, sig }), KEY);
    expect(failed.status).toBe(502);
    expect(await failed.text()).not.toContain('network down');
  });

  it('keeps every byte when the header arrives split across chunks', async () => {
    const parts = [PNG.subarray(0, 3), PNG.subarray(3, 9), PNG.subarray(9)];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const p of parts) controller.enqueue(p);
        controller.close();
      },
    });
    const res = await proxy(new Response(body, { headers: { 'content-type': 'image/png' } }));
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
  });

  it('cuts off a streamed body that exceeds the size limit', async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent > IMAGE_PROXY_MAX_BYTES + chunk.byteLength) {
          controller.close();
          return;
        }
        sent += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });
    const res = await proxy(new Response(body, { headers: { 'content-type': 'image/png' } }));
    expect(res.status).toBe(200);
    await expect(res.arrayBuffer()).rejects.toThrow();
  });
});
