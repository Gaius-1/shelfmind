/**
 * Multi-format retail barcode (GTIN) validation.
 *
 * Supports the formats that appear on retail packaging:
 *   - EAN-13  (13 digits)  — global retail standard
 *   - UPC-A   (12 digits)  — North American retail
 *   - EAN-8   (8 digits)   — small packages
 *   - UPC-E   (6/8 digits) — compressed UPC, expanded to UPC-A before validation
 *   - ITF-14  (14 digits)  — shipping/case codes (GTIN-14)
 *
 * Every GTIN format uses the same modulo-10 check-digit algorithm, so a single
 * validator covers all lengths once UPC-E is expanded.
 */

export type BarcodeFormat = "EAN_13" | "UPC_A" | "EAN_8" | "UPC_E" | "ITF_14";

export interface BarcodeValidation {
	/** The original input. */
	raw: string;
	/** Digits-only form actually validated (UPC-E is expanded to its 12-digit UPC-A). */
	normalized: string;
	/** Detected format, or null when the input is not a recognised GTIN length. */
	format: BarcodeFormat | null;
	/** True when the length is recognised and the check digit is correct. */
	valid: boolean;
	/** Human-readable explanation, useful for surfacing in the review UI. */
	message: string;
}

/** Strips every non-digit character. */
export function toDigits(raw: string): string {
	return (raw || "").replace(/\D/g, "");
}

/**
 * Computes the modulo-10 check digit for a GTIN payload (all digits except the
 * trailing check digit). Works for GTIN-8/12/13/14 — the rightmost payload digit
 * is weighted 3, then alternating 1, 3, 1, ... moving left.
 */
export function gtinCheckDigit(payload: string): number {
	let sum = 0;
	for (let i = 0; i < payload.length; i++) {
		// Count position from the right of the payload.
		const fromRight = payload.length - 1 - i;
		const weight = fromRight % 2 === 0 ? 3 : 1;
		sum += parseInt(payload[i], 10) * weight;
	}
	return (10 - (sum % 10)) % 10;
}

/** Validates the check digit of a full GTIN (8/12/13/14 digits). */
export function isValidGtin(code: string): boolean {
	if (!/^\d+$/.test(code)) return false;
	if (![8, 12, 13, 14].includes(code.length)) return false;
	const payload = code.slice(0, -1);
	const check = parseInt(code[code.length - 1], 10);
	return gtinCheckDigit(payload) === check;
}

/**
 * Backwards-compatible EAN-13 validator (kept for existing call sites).
 */
export function isValidEAN13(barcode: string): boolean {
	return /^\d{13}$/.test(barcode) && isValidGtin(barcode);
}

/**
 * Expands a UPC-E code to its full 12-digit UPC-A form.
 * Accepts either the 6-digit core, or the 7/8-digit form including the leading
 * number-system digit and/or trailing check digit. Returns null if it cannot be
 * expanded.
 */
export function expandUpcE(upce: string): string | null {
	const digits = toDigits(upce);

	let numberSystem = "0";
	let core: string; // 6-digit manufacturer/product core
	if (digits.length === 6) {
		core = digits;
	} else if (digits.length === 7) {
		// number system + 6 core, OR 6 core + check digit. Assume leading NS.
		numberSystem = digits[0];
		core = digits.slice(1);
	} else if (digits.length === 8) {
		numberSystem = digits[0];
		core = digits.slice(1, 7);
	} else {
		return null;
	}

	if (numberSystem !== "0" && numberSystem !== "1") return null;

	const lastDigit = core[5];
	let mfr: string;
	let prod: string;
	switch (lastDigit) {
		case "0":
		case "1":
		case "2":
			mfr = `${core.slice(0, 2) + lastDigit}00`;
			prod = `00${core.slice(2, 5)}`;
			break;
		case "3":
			mfr = `${core.slice(0, 3)}00`;
			prod = `000${core.slice(3, 5)}`;
			break;
		case "4":
			mfr = `${core.slice(0, 4)}0`;
			prod = `0000${core[4]}`;
			break;
		default:
			mfr = core.slice(0, 5);
			prod = `0000${lastDigit}`;
			break;
	}

	const upcaPayload = numberSystem + mfr + prod; // 11 digits
	const check = gtinCheckDigit(upcaPayload);
	return upcaPayload + check;
}

/** Detects a GTIN format purely from the digit length. */
function formatFromLength(len: number): BarcodeFormat | null {
	switch (len) {
		case 13:
			return "EAN_13";
		case 12:
			return "UPC_A";
		case 14:
			return "ITF_14";
		case 8:
			return "EAN_8";
		default:
			return null;
	}
}

/**
 * Validates a barcode across all supported retail formats and reports the
 * detected format plus a human-readable status.
 */
export function validateBarcode(raw: string): BarcodeValidation {
	const digits = toDigits(raw);

	if (!digits) {
		return {
			raw,
			normalized: "",
			format: null,
			valid: false,
			message: "No barcode",
		};
	}

	// 6 or 7 digits can only be a UPC-E core — expand and validate as UPC-A.
	if (digits.length === 6 || digits.length === 7) {
		const expanded = expandUpcE(digits);
		if (expanded && isValidGtin(expanded)) {
			return {
				raw,
				normalized: expanded,
				format: "UPC_E",
				valid: true,
				message: "Valid UPC-E",
			};
		}
		return {
			raw,
			normalized: digits,
			format: "UPC_E",
			valid: false,
			message: "Invalid UPC-E check digit",
		};
	}

	const format = formatFromLength(digits.length);
	if (!format) {
		// 8-digit values can be EAN-8 or UPC-E; handled above for EAN-8 fallthrough.
		return {
			raw,
			normalized: digits,
			format: null,
			valid: false,
			message: `Unsupported length (${digits.length} digits)`,
		};
	}

	// EAN-8: also try UPC-E expansion when the plain check digit fails.
	if (format === "EAN_8" && !isValidGtin(digits)) {
		const expanded = expandUpcE(digits);
		if (expanded && isValidGtin(expanded)) {
			return {
				raw,
				normalized: expanded,
				format: "UPC_E",
				valid: true,
				message: "Valid UPC-E",
			};
		}
	}

	const valid = isValidGtin(digits);
	const label = format.replace("_", "-");
	return {
		raw,
		normalized: digits,
		format,
		valid,
		message: valid ? `Valid ${label}` : `Invalid ${label} check digit`,
	};
}
