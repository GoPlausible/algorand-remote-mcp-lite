/**
 * Signed image proxy for MCP widgets.
 *
 * MCP hosts only load widget images from domains listed in the widget's CSP, and
 * Alpha Arcade market images live on varying hosts. The Alpha tools therefore
 * rewrite each image URL to `${IMAGE_PROXY_ORIGIN}${IMAGE_PROXY_PATH}?url=...&sig=...`,
 * and this Worker fetches the image and serves it from its own domain.
 *
 * The proxy:
 * - serves only URLs this server signed itself (HMAC-SHA256 with the IMAGE_PROXY_KEY
 *   secret, at least 32 characters; generate one with `openssl rand -hex 32`);
 * - determines the image type as browsers do in an image context (WHATWG MIME Sniffing
 *   Standard, "sniffing in an image context") and passes through only raster image types,
 *   never SVG, capped at IMAGE_PROXY_MAX_BYTES;
 * - serves them with headers that stop them from running as a page on this origin.
 */

export const IMAGE_PROXY_ORIGIN = "https://algorandmcplite.goplausible.xyz";
export const IMAGE_PROXY_PATH = "/api/image-proxy";
export const IMAGE_PROXY_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_PROXY_MIN_KEY_LENGTH = 32;

// Raster types only: SVG is a document format and could render links and text on this origin.
const ALLOWED_IMAGE_TYPES = new Set([
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
	"image/avif",
	"image/bmp",
	"image/x-icon",
]);

// WHATWG MIME Sniffing Standard, "image type pattern matching algorithm" table.
// No row ignores leading bytes. null in a pattern means mask 00 (any byte).
const IMAGE_TYPE_PATTERNS: { pattern: (number | null)[]; type: string }[] = [
	{ pattern: [0x00, 0x00, 0x01, 0x00], type: "image/x-icon" }, // Windows icon
	{ pattern: [0x00, 0x00, 0x02, 0x00], type: "image/x-icon" }, // Windows cursor
	{ pattern: [0x42, 0x4d], type: "image/bmp" }, // "BM"
	{ pattern: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], type: "image/gif" }, // "GIF87a"
	{ pattern: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], type: "image/gif" }, // "GIF89a"
	{
		// "RIFF" followed by four bytes of anything followed by "WEBPVP"
		pattern: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50],
		type: "image/webp",
	},
	{ pattern: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], type: "image/png" },
	{ pattern: [0xff, 0xd8, 0xff], type: "image/jpeg" },
];
const SNIFF_BYTES = 14; // longest pattern above

// Domain separation: this key signs image-proxy URLs and nothing else.
const SIGNATURE_CONTEXT = "algorand-remote-mcp-lite/image-proxy/v1\n";
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;

const encoder = new TextEncoder();
let cachedKey: { secret: string; key: Promise<CryptoKey> } | undefined;
let warnedAboutKey = false;

/** Returns the secret if it is long enough to use, else undefined (warning once per isolate). */
function usableKey(secret: string | undefined): string | undefined {
	if (secret && secret.length >= IMAGE_PROXY_MIN_KEY_LENGTH) return secret;
	if (!warnedAboutKey) {
		warnedAboutKey = true;
		console.warn(
			`[IMAGE_PROXY] IMAGE_PROXY_KEY is ${secret ? `shorter than ${IMAGE_PROXY_MIN_KEY_LENGTH} characters` : "not set"}; image proxying is disabled. Generate one with: openssl rand -hex 32`,
		);
	}
	return undefined;
}

function importProxyKey(secret: string): Promise<CryptoKey> {
	if (cachedKey?.secret !== secret) {
		cachedKey = {
			secret,
			key: crypto.subtle.importKey(
				"raw",
				encoder.encode(secret),
				{ name: "HMAC", hash: "SHA-256" },
				false,
				["sign", "verify"],
			),
		};
	}
	return cachedKey.key;
}

function toHex(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

/** Returns the normalised href of an http(s) URL, or undefined for anything else. */
function normaliseHttpUrl(value: string): string | undefined {
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
	} catch {
		return undefined;
	}
}

export async function signImageUrl(url: string, secret: string): Promise<string> {
	const key = await importProxyKey(secret);
	const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(SIGNATURE_CONTEXT + url));
	return toHex(mac);
}

export async function verifyImageUrlSignature(
	url: string,
	signature: string,
	secret: string,
): Promise<boolean> {
	if (!SIGNATURE_PATTERN.test(signature)) return false;
	const key = await importProxyKey(secret);
	return crypto.subtle.verify(
		"HMAC",
		key,
		fromHex(signature),
		encoder.encode(SIGNATURE_CONTEXT + url),
	);
}

/**
 * Returns the signed proxy URL for an image. Returns undefined when there is no image,
 * the URL is not http(s), or IMAGE_PROXY_KEY is missing or too short; the widgets then
 * show their letter-icon fallback.
 */
export async function proxiedImageUrl(
	url: string | null | undefined,
	secret: string | undefined,
): Promise<string | undefined> {
	if (!url) return undefined;
	const key = usableKey(secret);
	if (!key) return undefined;
	const href = normaliseHttpUrl(url);
	if (!href) return undefined;
	const signature = await signImageUrl(href, key);
	return `${IMAGE_PROXY_ORIGIN}${IMAGE_PROXY_PATH}?url=${encodeURIComponent(href)}&sig=${signature}`;
}

/** WHATWG MIME Sniffing: an XML MIME type has a subtype ending in "+xml", or is text/xml or application/xml. */
function isXmlMimeType(essence: string): boolean {
	return essence.endsWith("+xml") || essence === "text/xml" || essence === "application/xml";
}

/** WHATWG MIME Sniffing: image type pattern matching algorithm. */
function matchImageTypePattern(header: Uint8Array): string | undefined {
	for (const { pattern, type } of IMAGE_TYPE_PATTERNS) {
		if (header.length < pattern.length) continue;
		if (pattern.every((byte, i) => byte === null || header[i] === byte)) return type;
	}
	return undefined;
}

/**
 * WHATWG MIME Sniffing: computed MIME type in an image context.
 * `supplied` is the essence of the upstream Content-Type ("" when absent).
 */
export function computeImageMimeType(supplied: string, header: Uint8Array): string {
	if (isXmlMimeType(supplied)) return supplied;
	return matchImageTypePattern(header) ?? supplied;
}

/**
 * Reads the first SNIFF_BYTES of a stream without losing them.
 * Returns those bytes and a stream that yields the whole body from the start.
 */
async function peekHeader(
	body: ReadableStream<Uint8Array>,
): Promise<{ header: Uint8Array; stream: ReadableStream<Uint8Array> }> {
	const reader = body.getReader();
	const chunks: Uint8Array[] = [];
	let length = 0;
	let done = false;
	while (length < SNIFF_BYTES) {
		const result = await reader.read();
		if (result.done) {
			done = true;
			break;
		}
		chunks.push(result.value);
		length += result.value.byteLength;
	}

	const header = new Uint8Array(Math.min(length, SNIFF_BYTES));
	let offset = 0;
	for (const chunk of chunks) {
		if (offset >= header.length) break;
		const part = chunk.subarray(0, header.length - offset);
		header.set(part, offset);
		offset += part.byteLength;
	}

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(chunk);
			if (done) controller.close();
		},
		async pull(controller) {
			const result = await reader.read();
			if (result.done) controller.close();
			else controller.enqueue(result.value);
		},
		cancel(reason) {
			return reader.cancel(reason);
		},
	});
	return { header, stream };
}

/** Passes a stream through, erroring it once more than `maxBytes` have gone by. */
function limitBytes(body: ReadableStream<Uint8Array>, maxBytes: number): ReadableStream<Uint8Array> {
	let seen = 0;
	return body.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				seen += chunk.byteLength;
				if (seen > maxBytes) {
					controller.error(new Error("Image exceeds the proxy size limit"));
					return;
				}
				controller.enqueue(chunk);
			},
		}),
	);
}

function plainResponse(text: string, status: number): Response {
	return new Response(text, {
		status,
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
}

/** Handles GET IMAGE_PROXY_PATH. `requestUrl` is the full URL of the incoming request. */
export async function handleImageProxyRequest(
	requestUrl: string,
	secret: string | undefined,
): Promise<Response> {
	const params = new URL(requestUrl).searchParams;
	const target = params.get("url") ?? "";
	const signature = params.get("sig") ?? "";
	const key = usableKey(secret);

	if (
		!key ||
		normaliseHttpUrl(target) !== target ||
		!(await verifyImageUrlSignature(target, signature, key))
	) {
		return plainResponse("Forbidden", 403);
	}

	let upstream: Response;
	try {
		upstream = await fetch(target, {
			headers: { "User-Agent": "AlgorandMCPLite-ImageProxy/1.0", Accept: "image/*" },
		});
	} catch {
		return plainResponse("Bad gateway", 502);
	}

	const declaredLength = Number(upstream.headers.get("content-length") ?? "0");
	if (!upstream.ok || !upstream.body || !(declaredLength <= IMAGE_PROXY_MAX_BYTES)) {
		upstream.body?.cancel().catch(() => {});
		return plainResponse("Bad gateway", 502);
	}

	let peeked: { header: Uint8Array; stream: ReadableStream<Uint8Array> };
	try {
		peeked = await peekHeader(upstream.body);
	} catch {
		return plainResponse("Bad gateway", 502);
	}

	const supplied = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
	const contentType = computeImageMimeType(supplied, peeked.header);
	if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
		peeked.stream.cancel().catch(() => {});
		return plainResponse("Bad gateway", 502);
	}

	return new Response(limitBytes(peeked.stream, IMAGE_PROXY_MAX_BYTES), {
		status: 200,
		headers: {
			"Content-Type": contentType,
			"Cache-Control": "public, max-age=86400",
			"X-Content-Type-Options": "nosniff",
			"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
			"Cross-Origin-Resource-Policy": "cross-origin",
			"Referrer-Policy": "no-referrer",
		},
	});
}
