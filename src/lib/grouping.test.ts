import { describe, it, expect } from "vitest";
import { groupAndMergeImages, productsMatch, crossBatchProductsMatch, findCrossBatchMatch } from "./grouping.ts";
import type { IMDBProduct } from "../types/imdb.ts";

const createMockProduct = (overrides: Partial<IMDBProduct>): IMDBProduct => {
	return {
		ITEM_NAME: "",
		BARCODE: "",
		MANUFACTURER: "",
		BRAND: "",
		WEIGHT: "",
		PACKAGING_TYPE: "",
		COUNTRY: "",
		VARIANT: "",
		TYPE: "",
		FRAGRANCE_FLAVOR: "",
		PROMOTION: "",
		ADDONS: "",
		TAGLINE: "",
		sourceImages: [],
		...overrides,
	};
};

describe("groupAndMergeImages", () => {

	it("should merge two products from the same collector session if no conflicts exist", async () => {
		const entry1 = createMockProduct({
			ITEM_NAME: "Siya Tomato Paste",
			BRAND: "SIYA",
			sourceImages: ["S227094844_568727215.jpg"],
		});

		const entry2 = createMockProduct({
			ITEM_NAME: "",
			sourceImages: ["S227094844_568727216.jpg"],
		});

		const result = await groupAndMergeImages([entry1, entry2]);
		expect(result.length).toBe(1);
		expect(result[0].ITEM_NAME).toBe("Siya Tomato Paste");
		expect(result[0].sourceImages).toContain("S227094844_568727215.jpg");
		expect(result[0].sourceImages).toContain("S227094844_568727216.jpg");
	});

	it("should NOT merge two products from the same session if they have brand conflicts", async () => {
		const entry1 = createMockProduct({
			ITEM_NAME: "Siya Tomato Paste",
			BRAND: "SIYA",
			sourceImages: ["S227094844_568727215.jpg"],
		});

		const entry2 = createMockProduct({
			ITEM_NAME: "U-Fresh Orange Juice",
			BRAND: "U-FRESH",
			sourceImages: ["S227094844_568727216.jpg"],
		});

		const result = await groupAndMergeImages([entry1, entry2]);
		expect(result.length).toBe(2);
	});

	it("should NOT merge products with audit IDs carrying different product discriminators (_A vs _B)", async () => {
		const entry1 = createMockProduct({
			ITEM_NAME: "Kingsam Margarine",
			BRAND: "KINGSAM",
			imageTag: "GH000413316_A Kingsam Margarine",
			sourceImages: ["S11111_1.jpg"],
		});

		const entry2 = createMockProduct({
			ITEM_NAME: "Ena Pa Spread",
			BRAND: "ENA PA",
			imageTag: "GH000413316_B Ena Pa Margarine",
			sourceImages: ["S11111_2.jpg"],
		});

		const result = await groupAndMergeImages([entry1, entry2]);
		expect(result.length).toBe(2);
	});

	it("should merge products with fuzzy audit ID differences when no suffix is present", async () => {
		const entry1 = createMockProduct({
			ITEM_NAME: "Kivo Tomato Mix",
			BRAND: "KIVO",
			imageTag: "GH0005109020 Kivo Classic",
			sourceImages: ["S222_1.jpg"],
		});

		const entry2 = createMockProduct({
			ITEM_NAME: "Kivo Tomato Mix",
			BRAND: "KIVO",
			imageTag: "GH0005106020 Kivo Classic", // 1 character digit difference
			sourceImages: ["S222_2.jpg"],
		});

		const result = await groupAndMergeImages([entry1, entry2]);
		expect(result.length).toBe(1);
	});

	it("should merge products when one has a dot separator and the other has an underscore for the discriminator", async () => {
		const entry1 = createMockProduct({
			ITEM_NAME: "Kingsam Margarine",
			BRAND: "KINGSAM",
			imageTag: "GH000413316_A Kingsam Margarine Rich Butter Taste 250g sachet",
			sourceImages: ["S229_1.jpg"],
		});

		const entry2 = createMockProduct({
			ITEM_NAME: "Kingsam Margarine",
			BRAND: "KINGSAM",
			imageTag: "GH000413316.A",
			sourceImages: ["S229_2.jpg"],
		});

		const result = await groupAndMergeImages([entry1, entry2]);
		expect(result.length).toBe(1);
	});

	it("should merge products when one has a space or hyphen separator for the discriminator", async () => {
		const entry1 = createMockProduct({
			ITEM_NAME: "Sister Stew",
			BRAND: "SISTER",
			imageTag: "GH000413323-A Sister Stew 10g",
			sourceImages: ["S230_1.jpg"],
		});

		const entry2 = createMockProduct({
			ITEM_NAME: "Sister Stew",
			BRAND: "SISTER",
			imageTag: "GH000413323 A Sister Stew 10g",
			sourceImages: ["S230_2.jpg"],
		});

		const result = await groupAndMergeImages([entry1, entry2]);
		expect(result.length).toBe(1);
	});
});

describe("productsMatch", () => {
	it("matches two angles of the same product via shared session prefix", () => {
		const a = createMockProduct({ ITEM_NAME: "Siya Tomato Paste", BRAND: "SIYA", sourceImages: ["S227094844_1.jpg"] });
		const b = createMockProduct({ sourceImages: ["S227094844_2.jpg"] });
		expect(productsMatch(a, b)).toBe(true);
	});

	it("blocks products sharing an audit ID but with different _A/_B discriminators", () => {
		const a = createMockProduct({ imageTag: "GH000413316_A Kingsam Rice 5kg", ITEM_NAME: "Kingsam Rice" });
		const b = createMockProduct({ imageTag: "GH000413316_B Ena Pasta 500g", ITEM_NAME: "Ena Pasta" });
		expect(productsMatch(a, b)).toBe(false);
	});
});

describe("crossBatchProductsMatch", () => {
	it("links the same product across batches on a matching watermark audit ID", () => {
		const earlier = createMockProduct({
			ITEM_NAME: "Zesta Ginger Tea",
			imageTag: "GH000413323 Zesta Ginger Tea 57.6g",
		});
		const later = createMockProduct({
			ITEM_NAME: "Zesta Ginger Tea",
			imageTag: "GH000413323 Zesta Ginger Tea 57.6g",
		});
		expect(crossBatchProductsMatch(earlier, later)).toBe(true);
	});

	it("links across batches on a fuzzy barcode even when the name is noisy", () => {
		const earlier = createMockProduct({ ITEM_NAME: "Coke 50cl", BRAND: "COCA COLA", BARCODE: "5449000000996" });
		const later = createMockProduct({ ITEM_NAME: "Cocacola Bottle", BRAND: "COCA COLA", BARCODE: "5449000000996" });
		expect(crossBatchProductsMatch(earlier, later)).toBe(true);
	});

	it("does NOT link records that match only on a weak signal (brand) when a strong signal is required", () => {
		const earlier = createMockProduct({ ITEM_NAME: "Brand X Soap", BRAND: "OMO", WEIGHT: "500g" });
		const later = createMockProduct({ ITEM_NAME: "Brand X Soap", BRAND: "OMO", WEIGHT: "500g" });
		// No barcode and no audit ID → no strong signal, so cross-batch link is withheld.
		expect(crossBatchProductsMatch(earlier, later)).toBe(false);
		// ...but with the strong-signal gate disabled, the name match is honoured.
		expect(crossBatchProductsMatch(earlier, later, false)).toBe(true);
	});

	it("does not link genuinely different products across batches", () => {
		const earlier = createMockProduct({ ITEM_NAME: "Omo Detergent", BRAND: "OMO", BARCODE: "5449000000996" });
		const later = createMockProduct({ ITEM_NAME: "Ariel Detergent", BRAND: "ARIEL", BARCODE: "4006381333931" });
		expect(crossBatchProductsMatch(earlier, later)).toBe(false);
	});
});

describe("findCrossBatchMatch", () => {
	it("returns the first prior-batch candidate that is the same product", () => {
		const record = createMockProduct({ ITEM_NAME: "Milo 400g", BRAND: "MILO", BARCODE: "6001068600014" });
		const candidates = [
			createMockProduct({ ITEM_NAME: "Bournvita", BRAND: "BOURNVITA", BARCODE: "5449000000996" }),
			createMockProduct({ ITEM_NAME: "Milo Tin", BRAND: "MILO", BARCODE: "6001068600014" }),
		];
		const match = findCrossBatchMatch(record, candidates);
		expect(match).not.toBeNull();
		expect(match?.ITEM_NAME).toBe("Milo Tin");
	});

	it("returns null when no prior-batch candidate shares a strong signal", () => {
		const record = createMockProduct({ ITEM_NAME: "Milo 400g", BRAND: "MILO" });
		const candidates = [createMockProduct({ ITEM_NAME: "Bournvita", BRAND: "BOURNVITA" })];
		expect(findCrossBatchMatch(record, candidates)).toBeNull();
	});
});
