## Dataset overview

1. Contents: 45 distinct products; each product has 3–4 images showing different sides/angles. Each image includes an image tag at the bottom that contains a descriptive product name.

2. Ground truth: An Excel file (provided) containing expected tabular IMDB records for each product. Each product’s entries are grouped into the exact columns described below. Use the Excel file as the ground truth for measuring performance and fine-tuning models.

3. The dataset is **NOT** presplit into train/test. Participants may choose any split strategy they prefer.  
4. Each image contains an image tag at the bottom with a descriptive name for the product.  
5. Participants must reproduce the following columns exactly (column names and intended content are shown):

   * **ITEM\_NAME** — Full descriptive product name as intended for the catalog (string).

   * **BARCODE** — Numeric barcode as printed on the package; numeric string without spaces/dashes.

   * **MANUFACTURER** — Company that manufactures the product (string).

   * **BRAND** — Brand name as shown on the package (string).

   * **WEIGHT** — Net weight or net volume (including unit). Use the same format as ground truth (examples: "250G", "430G", "1.5 KG", "500 ML").

   * **PACKAGING TYPE** — Packaging form (examples: "TUB", "GLASS JAR", "SACHET", "BOTTLE", "CAN").

   * **COUNTRY** — Country of manufacture/packing (string).

   * **VARIANT** — Product variant if applicable (e.g., "ORIGINAL", "LOW FAT"); empty if not applicable.

   * **TYPE** — Product type or short category (e.g., "MARGARINE", "MAYONNAISE", "BUTTER").

   * **FRAGRANCE\_FLAVOR** — Flavor or fragrance where applicable (e.g., "RICH", "ORIGINAL"); empty if not applicable.

   * **PROMOTION** — Any on-pack promotion text the ground truth includes (e.g., "50% OFF"); empty if not applicable.

   * **ADDONS** — Additional product features or pack contents (e.g., "SPOON INCLUDED"); empty if not applicable.

   * **TAGLINE** — Short promotional or descriptive tagline (string); may be empty.

6. The Excel sheet provided is the authoritative source; produce your output in the same column order and with the same column names. If you prefer to include an extra column (e.g., filename/image\_id), include it but keep the required 13 columns unchanged.

7. Output file format (submission)

* Required: predictions must be delivered as a single file, either:

  * predictions.csv (UTF-8, comma separated) or

  * predictions.xlsx (one row per product/image as used in the ground truth).

* The file must contain the 13 required columns above. 

* If a field cannot be confidently extracted from the image, leave it empty (use empty string) rather than guessing.

**NB.**

Participants are encouraged to aggregate evidence across images to fill missing fields, as one single image may not contain all descriptive details of the product.

