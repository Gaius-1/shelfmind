import ExcelJS from 'exceljs'
import { EXCEL_HEADERS, IMDB_COLUMNS } from '../types/imdb.ts'
import { saveExport, getFileUrl } from './storage.ts'

/**
 * Generates an Excel workbook predictions.xlsx from extracted records.
 * Saves it to R2 (or local mock folder) and returns a streaming endpoint URL.
 */
export async function generateExcelExport(
  orgId: string,
  jobId: string,
  records: any[],
  includeMetadata: boolean = false
): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Predictions')

  // Construct column definitions
  const cols = IMDB_COLUMNS.map(col => ({
    header: EXCEL_HEADERS[col],
    key: col,
    width: 20
  }))

  if (includeMetadata) {
    cols.push(
      { header: 'CONFIDENCE', key: 'confidence', width: 15 },
      { header: 'FLAGGED', key: 'flagged', width: 12 }
    )
  }

  worksheet.columns = cols

  // Format header row (Bold Segoe UI, white text on indigo background)
  const headerRow = worksheet.getRow(1)
  headerRow.font = { name: 'Segoe UI', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' } // Indigo-600 color
  }
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' }
  headerRow.height = 26

  // Add data rows
  records.forEach((record, index) => {
    const rowData: any = {}
    for (const col of IMDB_COLUMNS) {
      rowData[col] = record[col] ?? ''
    }

    if (includeMetadata) {
      rowData.confidence = typeof record.confidence === 'number' 
        ? `${Math.round(record.confidence * 100)}%` 
        : ''
      rowData.flagged = record.flagged ? 'YES' : 'NO'
    }

    const row = worksheet.addRow(rowData)
    row.height = 20
    row.font = { name: 'Segoe UI', size: 10 }

    // Alternating row background (zebra striping)
    if (index % 2 === 1) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9FAFB' } // Tailwind neutral Slate/Gray 50
      }
    }
  })

  // Freeze top row
  worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }]

  // Set column widths based on header length (more reliable than eachCell in Workers)
  worksheet.columns.forEach(column => {
    const headerLen = column.header ? String(column.header).length : 12
    column.width = Math.max(14, Math.min(40, headerLen + 6))
  })

  // Write workbook to buffer
  const buffer = await workbook.xlsx.writeBuffer()
  const fileName = 'predictions.xlsx'
  const key = await saveExport(orgId, jobId, fileName, buffer as Buffer)

  return getFileUrl('EXPORTS', key)
}
