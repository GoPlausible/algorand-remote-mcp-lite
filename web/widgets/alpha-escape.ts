/**
 * HTML escaping for the Alpha Arcade widgets.
 *
 * Market data (titles, descriptions, categories, option names, images, ids) can come from
 * any Algorand application's on-chain state or from the Alpha API, so every value that is
 * interpolated into an innerHTML template must pass through esc(). esc() is safe in HTML
 * text and inside double- or single-quoted attribute values. It is not safe inside inline
 * event handlers, <script> or unquoted attributes; the widgets use none of those for data.
 */
export function esc(value: unknown): string {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
