import { ipcMain } from 'electron'
import { readFile, readdir } from 'fs/promises'
import { join, extname } from 'path'
import mammoth from 'mammoth'

export function registerDocPreviewHandlers() {
  // Scan for .docx files in a directory
  ipcMain.handle('docs:scanDocx', async (_event, folderPath: string) => {
    try {
      const entries = await readdir(folderPath, { withFileTypes: true })
      const docFiles = entries
        .filter(e => e.isFile() && extname(e.name).toLowerCase() === '.docx')
        .map(e => ({
          name: e.name,
          path: join(folderPath, e.name),
        }))
      return docFiles
    } catch {
      return []
    }
  })

  // Convert .docx to HTML
  ipcMain.handle('docs:convertDocx', async (_event, filePath: string) => {
    const buffer = await readFile(filePath)
    const result = await mammoth.convertToHtml({ buffer })
    return result.value
  })
}
