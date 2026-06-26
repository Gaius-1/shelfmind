/**
 * ShelfMind extraction evaluation harness.
 *
 * Loads the model output (`context/output_results.xlsx - Sheet1.csv`) and
 * compares it field-by-field against the official ground-truth Excel, applying
 * the SAME normalization used by the live pipeline (`src/lib/normalization.ts`).
 *
 * It computes:
 *   - per-column accuracy (exact match after normalization)
 *   - overall accuracy across all 13 IMDB columns
 *   - the number of fully-correct products (all 13 columns match)
 *
 * Results are printed as a table and written to `context/eval_results.json`.
 *
 * IMPORTANT: The ground-truth Excel is NOT shipped in the repo. If it is
 * missing, this script FAILS LOUDLY with setup instructions. It never invents
 * or estimates accuracy numbers.
 *
 * Usage:
 *   bun run src/scripts/evaluate.ts
 *   bun run src/scripts/evaluate.ts --ground-truth=context/ground_truth.xlsx
 *   bun run src/scripts/evaluate.ts --model=context/output_results.xlsx\ -\ Sheet1.csv
 */

import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { normalizeField } from "../lib/normalization.ts";
import { IMDB_COLUMNS, type ImdbColumnName } from "../types/imdb.ts";

const DEFAULT_MODEL_OUTPUT = "context/output_results.xlsx - Sheet1.csv";
const DEFAULT_GROUND_TRUTH = "context/ground_truth.xlsx";
const OUTPUT_JSON = "context/eval_results.json";

interface CliArgs {
	modelPath: string;
	groundTruthPath: string;
}

function parseArgs(argv: string[]): CliArgs {
	let modelPath = DEFAULT_MODEL_OUTPUT;
	let groundTruthPath = DEFAULT_GROUND_TRUTH;
	for (const arg of argv) {
		if (arg.startsWith("--model=")) modelPath = arg.slice("--model=".length);
		else if (arg.startsWith("--ground-truth="))
			groundTruthPath = arg.slice("--ground-truth=".length);
	}
	return { modelPath, groundTruthPath };
}

/**
 * Canonicalizes an arbitrary spreadsheet header into one of the 13 IMDB column
 * names. Handles the known header variants seen across the model output and the
 * ground truth (e.g. "PACKAGING  TYPE", "PACKAGING TYPE", "PACKAGING_TYPE" all
 * resolve to PACKAGING_TYPE).
 */
function resolveColumn(header: string): ImdbColumnName | null {
	const key = header
		.trim()
		.toUpperCase()
		.replace(/[\s_]+/g, "_");
	for (const col of IMDB_COLUMNS) {
		if (key === col) return col;
	}
	return null;
}

/**
 * Reads a CSV or XLSX file (first sheet) into an array of normalized IMDB
 * records, one per product row. Unknown/extra columns (e.g. image_id) are
 * ignored. Missing columns default to "".
 */
function loadRecords(filePath: string): Record<ImdbColumnName, string>[] {
	const wb = XLSX.readFile(filePath, { raw: false });
	const sheetName = wb.SheetNames[0];
	const sheet = wb.Sheets[sheetName];
	const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
		defval: "",
		raw: false,
	});

	return rows.map((row) => {
		// Map raw headers -> canonical columns for this row.
		const canonical: Partial<Record<ImdbColumnName, string>> = {};
		for (const [header, value] of Object.entries(row)) {
			const col = resolveColumn(header);
			if (col) canonical[col] = value == null ? "" : String(value);
		}
		// Normalize every column with the SAME logic the pipeline uses.
		const normalized = {} as Record<ImdbColumnName, string>;
		for (const col of IMDB_COLUMNS) {
			normalized[col] = normalizeField(col, canonical[col] ?? "");
		}
		return normalized;
	});
}

function failLoud(message: string): never {
	console.error("\n────────────────────────────────────────────────────────");
	console.error("EVALUATION ABORTED");
	console.error("────────────────────────────────────────────────────────");
	console.error(message);
	console.error("────────────────────────────────────────────────────────\n");
	process.exit(1);
}

function pct(numerator: number, denominator: number): number {
	if (denominator === 0) return 0;
	return Math.round((numerator / denominator) * 10000) / 100;
}

function main(): void {
	const { modelPath, groundTruthPath } = parseArgs(process.argv.slice(2));
	const cwd = process.cwd();
	const absModel = resolve(cwd, modelPath);
	const absGroundTruth = resolve(cwd, groundTruthPath);

	if (!existsSync(absModel)) {
		failLoud(
			`Model output file not found at:\n  ${absModel}\n\n` +
				`Expected the 45-product model output CSV. Pass --model=<path> to override.`,
		);
	}

	if (!existsSync(absGroundTruth)) {
		failLoud(
			`Ground-truth Excel not found at:\n  ${absGroundTruth}\n\n` +
				`The official ground-truth file is NOT committed to this repository.\n` +
				`To run a real evaluation you must add it yourself:\n\n` +
				`  1. Place the official ground-truth Excel at:\n` +
				`       ${groundTruthPath}\n` +
				`     (or pass --ground-truth=<path> to point elsewhere)\n` +
				`  2. It must contain one row per product with the 13 IMDB columns:\n` +
				`       ${IMDB_COLUMNS.join(", ")}\n` +
				`  3. Re-run:  bun run src/scripts/evaluate.ts\n\n` +
				`This script will NOT fabricate or estimate accuracy. No scores were written.`,
		);
	}

	const modelRecords = loadRecords(absModel);
	const groundTruthRecords = loadRecords(absGroundTruth);

	if (modelRecords.length === 0) {
		failLoud(`Model output file contained no data rows:\n  ${absModel}`);
	}
	if (groundTruthRecords.length === 0) {
		failLoud(`Ground-truth file contained no data rows:\n  ${absGroundTruth}`);
	}
	if (modelRecords.length !== groundTruthRecords.length) {
		failLoud(
			`Row count mismatch — cannot align records by position.\n` +
				`  Model output rows: ${modelRecords.length}\n` +
				`  Ground-truth rows: ${groundTruthRecords.length}\n\n` +
				`Both files must have the same number of product rows, in the same order.`,
		);
	}

	// Records are aligned by row position (the dataset spec requires the model
	// output to use the same row order as the ground truth).
	const total = modelRecords.length;
	const perColumn: Record<
		ImdbColumnName,
		{ correct: number; total: number; accuracy: number }
	> = {} as never;
	for (const col of IMDB_COLUMNS) {
		perColumn[col] = { correct: 0, total, accuracy: 0 };
	}

	const mismatches: {
		row: number;
		column: ImdbColumnName;
		model: string;
		groundTruth: string;
	}[] = [];

	let fullyCorrect = 0;
	let correctCells = 0;
	const totalCells = total * IMDB_COLUMNS.length;

	for (let i = 0; i < total; i++) {
		const model = modelRecords[i];
		const truth = groundTruthRecords[i];
		let rowAllCorrect = true;
		for (const col of IMDB_COLUMNS) {
			if (model[col] === truth[col]) {
				perColumn[col].correct++;
				correctCells++;
			} else {
				rowAllCorrect = false;
				mismatches.push({
					row: i + 1,
					column: col,
					model: model[col],
					groundTruth: truth[col],
				});
			}
		}
		if (rowAllCorrect) fullyCorrect++;
	}

	for (const col of IMDB_COLUMNS) {
		perColumn[col].accuracy = pct(perColumn[col].correct, perColumn[col].total);
	}

	const overallAccuracy = pct(correctCells, totalCells);
	const fullyCorrectPct = pct(fullyCorrect, total);

	// ── Print results table ────────────────────────────────────────────────
	console.log("\nShelfMind Extraction Evaluation");
	console.log("================================");
	console.log(`Model output : ${modelPath}`);
	console.log(`Ground truth : ${groundTruthPath}`);
	console.log(`Products     : ${total}`);
	console.log("");
	console.log("Per-column accuracy (exact match after normalization):");
	console.log("┌──────────────────────┬─────────┬─────────┬───────────┐");
	console.log("│ Column               │ Correct │ Total   │ Accuracy  │");
	console.log("├──────────────────────┼─────────┼─────────┼───────────┤");
	for (const col of IMDB_COLUMNS) {
		const c = perColumn[col];
		console.log(
			`│ ${col.padEnd(20)} │ ${String(c.correct).padStart(7)} │ ${String(
				c.total,
			).padStart(7)} │ ${`${c.accuracy}%`.padStart(9)} │`,
		);
	}
	console.log("└──────────────────────┴─────────┴─────────┴───────────┘");
	console.log("");
	console.log(
		`Overall cell accuracy : ${correctCells}/${totalCells} = ${overallAccuracy}%`,
	);
	console.log(
		`Fully-correct products: ${fullyCorrect}/${total} = ${fullyCorrectPct}%`,
	);
	console.log("");

	const results = {
		generatedAt: new Date().toISOString(),
		modelOutputFile: modelPath,
		groundTruthFile: groundTruthPath,
		productCount: total,
		columns: IMDB_COLUMNS,
		perColumn,
		overall: {
			correctCells,
			totalCells,
			accuracy: overallAccuracy,
		},
		fullyCorrectProducts: {
			count: fullyCorrect,
			total,
			percentage: fullyCorrectPct,
		},
		mismatchCount: mismatches.length,
		mismatches,
	};

	const absOut = resolve(cwd, OUTPUT_JSON);
	writeFileSync(absOut, `${JSON.stringify(results, null, 2)}\n`, "utf8");
	console.log(`Wrote results to ${OUTPUT_JSON}`);
}

main();
