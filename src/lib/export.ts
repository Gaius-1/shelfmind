import * as XLSX from 'xlsx'
import { EXCEL_HEADERS, IMDB_COLUMNS } from '../types/imdb.ts'
import { saveExport, getFileUrl } from './storage.ts'

/**
 * Generates an Excel workbook predictions.xlsx from extracted records.
 * Saves it to R2 (or local mock folder) and returns a streaming endpoint URL.
 *
 * Uses SheetJS/xlsx instead of exceljs because the latter depends on
 * Node.js APIs (process.umask, fs streams) that are incompatible with
 * the Cloudflare Workers runtime.
 */
export async function generateExcelExport(
  orgId: string,
  jobId: string,
  records: any[],
  includeMetadata: boolean = false
): Promise<string> {
  // Build header row labels
  const headers = IMDB_COLUMNS.map(col => EXCEL_HEADERS[col])
  if (includeMetadata) {
    headers.push('CONFIDENCE', 'FLAGGED')
  }

  // Build data rows as 2D arrays
  const dataRows: any[][] = records.map(record => {
    const row = IMDB_COLUMNS.map(col => record[col] ?? '')
    if (includeMetadata) {
      row.push(
        typeof record.confidence === 'number'
          ? `${Math.round(record.confidence * 100)}%`
          : '',
        record.flagged ? 'YES' : 'NO',
      )
    }
    return row
  })

  // Combine into one worksheet array (header + rows)
  const wsData = [headers, ...dataRows]

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // ── Styling ──────────────────────────────────────────────────────────────
  // Helper to encode cell reference
  const cellRef = (r: number, c: number) => XLSX.utils.encode_cell({ r, c })

  // 1. Header row — bold white text on indigo-600 background
  for (let c = 0; c < headers.length; c++) {
    const ref = cellRef(0, c)
    if (!ws[ref]) ws[ref] = { t: 's', v: headers[c] }
    ws[ref].s = {
      font: { name: 'Segoe UI', bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '4F46E5' } },
      alignment: { vertical: 'center', horizontal: 'left' },
    }
  }

  // 2. Data rows — Segoe UI 10pt with zebra striping (odd rows get a light gray fill)
  for (let r = 1; r < wsData.length; r++) {
    for (let c = 0; c < wsData[r].length; c++) {
      const ref = cellRef(r, c)
      if (!ws[ref]) ws[ref] = { t: 's', v: '' }
      ws[ref].s = {
        font: { name: 'Segoe UI', sz: 10 },
        // Even rows (r=2,4,6...) get zebra striping to match original exceljs behavior (index % 2 === 1)
        ...(r % 2 === 0 ? { fill: { fgColor: { rgb: 'F9FAFB' } } } : {}),
      }
    }
  }

  // 3. Column widths — sized to header text with padding
  ws['!cols'] = headers.map(h => ({
    wch: Math.max(14, Math.min(40, String(h).length + 6)),
  }))

  // 4. Row heights
  ws['!rows'] = [
    { hpt: 26 }, // header
    ...dataRows.map(() => ({ hpt: 20 })),
  ]

  // 5. Freeze the top header row so it stays visible when scrolling
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  // Attach sheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Predictions')

  // Write to a Uint8Array buffer (pure in-memory — no fs/stream needed)
  const uint8 = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  const buffer = Buffer.from(uint8)

  const fileName = 'predictions.xlsx'
  const key = await saveExport(orgId, jobId, fileName, buffer)

  return getFileUrl('EXPORTS', key)
}
