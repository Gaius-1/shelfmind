/**
 * Real barcode decoding via the ZXing WebAssembly reader.
 *
 * This replaces the previously hard-coded `zxing: null` in the pipeline with an
 * actual scanner pass over the image bytes. It is intentionally defensive: any
 * failure to load the WASM module or decode an image returns `null` so the
 * extraction pipeline degrades gracefully to the vision/watermark barcode rather
 * than throwing.
 */
import { type ReaderOptions, readBarcodes } from "zxing-wasm/reader";
import { validateBarcode } from "./barcode.ts";

export interface DecodedBarcode {
	/** The decoded digit string. */
	text: string;
	/** ZXing's reported symbology (e.g. "EAN-13", "UPC-A"). */
	format: string;
	/** Whether the decoded value passes GTIN check-digit validation. */
	valid: boolean;
}

const READER_OPTIONS: ReaderOptions = {
	formats: ["EAN-13", "EAN-8", "UPC-A", "UPC-E", "ITF", "Code128", "DataBar"],
	tryHarder: true,
};

/**
 * Attempts to decode a retail barcode from raw image bytes.
 * Returns the best valid GTIN found, or the first decode if none validate, or
 * `null` when nothing is read / the reader is unavailable.
 */
export async function decodeBarcodeFromImage(
	buffer: ArrayBuffer,
): Promise<DecodedBarcode | null> {
	try {
		const blob = new Blob([buffer]);
		const results = await readBarcodes(blob, READER_OPTIONS);
		if (!results || results.length === 0) return null;

		const decoded: DecodedBarcode[] = results
			.filter((r) => r.text)
			.map((r) => ({
				text: r.text,
				format: r.format,
				valid: validateBarcode(r.text).valid,
			}));

		if (decoded.length === 0) return null;

		// Prefer a result that passes check-digit validation.
		return decoded.find((d) => d.valid) ?? decoded[0];
	} catch (err) {
		console.error("[ZXing] Barcode decode failed:", err);
		return null;
	}
}
