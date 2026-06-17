import { describe, it, expect } from "vitest";
import { groupAndMergeImages } from "./grouping.ts";
import type { IMDBProduct } from "../types/imdb.ts";

describe("groupAndMergeImages", () => {
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
