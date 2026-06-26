import { describe, expect, it } from "vitest";
import {
	expandUpcE,
	gtinCheckDigit,
	isValidEAN13,
	isValidGtin,
	toDigits,
	validateBarcode,
} from "./barcode.ts";

describe("gtinCheckDigit", () => {
	it("computes the EAN-13 check digit", () => {
		// 4006381333931 -> payload 400638133393, check 1
		expect(gtinCheckDigit("400638133393")).toBe(1);
	});

	it("computes the UPC-A check digit", () => {
		// 036000291452 -> payload 03600029145, check 2
		expect(gtinCheckDigit("03600029145")).toBe(2);
	});
});

describe("isValidGtin", () => {
	it("accepts valid EAN-13, UPC-A, EAN-8, and ITF-14 codes", () => {
		expect(isValidGtin("4006381333931")).toBe(true); // EAN-13
		expect(isValidGtin("036000291452")).toBe(true); // UPC-A
		expect(isValidGtin("96385074")).toBe(true); // EAN-8
		expect(isValidGtin("00012345678905")).toBe(true); // ITF-14
	});

	it("rejects bad check digits", () => {
		expect(isValidGtin("4006381333932")).toBe(false);
		expect(isValidGtin("036000291451")).toBe(false);
	});

	it("rejects unsupported lengths and non-digits", () => {
		expect(isValidGtin("12345")).toBe(false);
		expect(isValidGtin("123456789012345")).toBe(false);
		expect(isValidGtin("40063813A3931")).toBe(false);
	});
});

describe("isValidEAN13 (backwards compatible)", () => {
	it("only validates 13-digit codes", () => {
		expect(isValidEAN13("4006381333931")).toBe(true);
		expect(isValidEAN13("036000291452")).toBe(false); // 12 digits
	});
});

describe("expandUpcE", () => {
	it("expands a UPC-E core to a valid UPC-A", () => {
		const upca = expandUpcE("123456");
		expect(upca).not.toBeNull();
		expect(upca).toHaveLength(12);
		expect(isValidGtin(upca as string)).toBe(true);
	});

	it("returns null for invalid lengths", () => {
		expect(expandUpcE("12")).toBeNull();
		expect(expandUpcE("123456789")).toBeNull();
	});
});

describe("validateBarcode", () => {
	it("detects and validates EAN-13", () => {
		const r = validateBarcode("4006381333931");
		expect(r.format).toBe("EAN_13");
		expect(r.valid).toBe(true);
	});

	it("detects and validates UPC-A", () => {
		const r = validateBarcode("036000291452");
		expect(r.format).toBe("UPC_A");
		expect(r.valid).toBe(true);
	});

	it("detects and validates EAN-8", () => {
		const r = validateBarcode("96385074");
		expect(r.format).toBe("EAN_8");
		expect(r.valid).toBe(true);
	});

	it("detects and validates ITF-14", () => {
		const r = validateBarcode("00012345678905");
		expect(r.format).toBe("ITF_14");
		expect(r.valid).toBe(true);
	});

	it("validates a UPC-E core and expands it", () => {
		const r = validateBarcode("123456");
		expect(r.format).toBe("UPC_E");
		expect(r.valid).toBe(true);
		expect(r.normalized).toHaveLength(12);
	});

	it("strips non-digit characters before validating", () => {
		const r = validateBarcode("4 006381 333931");
		expect(r.valid).toBe(true);
		expect(r.normalized).toBe("4006381333931");
	});

	it("flags an invalid check digit", () => {
		const r = validateBarcode("4006381333932");
		expect(r.format).toBe("EAN_13");
		expect(r.valid).toBe(false);
		expect(r.message).toMatch(/Invalid/);
	});

	it("flags unsupported lengths", () => {
		const r = validateBarcode("12345");
		expect(r.valid).toBe(false);
		expect(r.format).toBeNull();
	});

	it("handles empty input", () => {
		const r = validateBarcode("");
		expect(r.valid).toBe(false);
		expect(r.message).toBe("No barcode");
	});
});

describe("toDigits", () => {
	it("removes whitespace and symbols", () => {
		expect(toDigits(" 12-34 56 ")).toBe("123456");
	});
});
