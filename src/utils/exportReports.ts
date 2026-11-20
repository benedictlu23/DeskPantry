export interface ExcelSheetData {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

function escapeXml(val: string | number): string {
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function exportExcelWorkbook(filename: string, sheets: ExcelSheetData[]) {
  const worksheetsXml = sheets
    .map((sheet) => {
      const safeName = escapeXml(sheet.name.slice(0, 31));
      const headerCells = sheet.headers
        .map(
          (h) =>
            `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`
        )
        .join('');
      const bodyRows = sheet.rows
        .map((row) => {
          const cells = row
            .map((cell) => {
              const isNum = typeof cell === 'number' && Number.isFinite(cell);
              return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(
                cell
              )}</Data></Cell>`;
            })
            .join('');
          return `<Row>${cells}</Row>`;
        })
        .join('');

      return `<Worksheet ss:Name="${safeName}"><Table><Row>${headerCells}</Row>${bodyRows}</Table></Worksheet>`;
    })
    .join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#E6F4F1" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 ${worksheetsXml}
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface PdfReportSection {
  heading: string;
  lines: string[];
}

function escapePdfText(text: string): string {
  // Replace peso sign with PHP for standard PDF WinAnsi encoding compatibility
  const clean = text.replace(/₱/g, 'PHP ').replace(/[^\x20-\x7E]/g, ' ');
  return clean.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export function exportPdfReport(
  filename: string,
  title: string,
  subtitle: string,
  sections: PdfReportSection[]
) {
  const allLines: { text: string; bold?: boolean; size?: number }[] = [
    { text: title, bold: true, size: 15 },
    { text: subtitle, size: 9 },
    { text: '------------------------------------------------------------------------------------', size: 9 },
  ];

  for (const sec of sections) {
    allLines.push({ text: '', size: 8 });
    allLines.push({ text: sec.heading, bold: true, size: 11 });
    for (const line of sec.lines) {
      allLines.push({ text: line, size: 9 });
    }
  }

  // Paginate lines (~48 lines per US Letter page)
  const pages: typeof allLines[] = [];
  let currentPage: typeof allLines = [];
  for (const line of allLines) {
    currentPage.push(line);
    if (currentPage.length >= 48) {
      pages.push(currentPage);
      currentPage = [];
    }
  }
  if (currentPage.length > 0) pages.push(currentPage);

  // Build valid PDF 1.4 object stream
  const objects: string[] = [];
  const addObj = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const fontRegularId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  const fontBoldId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>');
  const pagesPlaceholderId = addObj(''); // filled later

  const pageIds: number[] = [];
  for (const pageLines of pages) {
    const streamCmds: string[] = ['BT'];
    let y = 748;
    for (const ln of pageLines) {
      const fontName = ln.bold ? '/F2' : '/F1';
      const fontSize = ln.size ?? 9;
      streamCmds.push(`${fontName} ${fontSize} Tf`);
      streamCmds.push(`1 0 0 1 42 ${y} Tm`);
      streamCmds.push(`(${escapePdfText(ln.text)}) Tj`);
      y -= fontSize + 5;
    }
    streamCmds.push('ET');
    const contentStr = streamCmds.join('\n');
    const contentId = addObj(
      `<< /Length ${contentStr.length} >>\nstream\n${contentStr}\nendstream`
    );
    const pageId = addObj(
      `<< /Type /Page /Parent ${pagesPlaceholderId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  objects[pagesPlaceholderId - 1] = `<< /Type /Pages /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(' ')}] /Count ${pageIds.length} >>`;

  const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesPlaceholderId} 0 R >>`);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
