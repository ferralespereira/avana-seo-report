const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageNumber, PageBreak, Header, Footer,
  TabStopType, TabStopPosition, VerticalAlign
} = require('docx');
const fs = require('fs');

const C = {
  navy:      "1B3A5C",
  teal:      "0E7C7B",
  gold:      "C9A84C",
  lightBlue: "D6E8F5",
  lightGray: "F4F6F8",
  midGray:   "CCCCCC",
  darkGray:  "444444",
  white:     "FFFFFF",
  red:       "C0392B",
  green:     "1E7E34",
  orange:    "E67E22",
};

const border = (color = C.midGray) => ({ style: BorderStyle.SINGLE, size: 1, color });
const noBorder = () => ({ style: BorderStyle.NONE, size: 0, color: "FFFFFF" });
const allBorders = (color) => ({ top: border(color), bottom: border(color), left: border(color), right: border(color) });
const noBorders = () => ({ top: noBorder(), bottom: noBorder(), left: noBorder(), right: noBorder() });
const sp = (before = 0, after = 0) => ({ spacing: { before, after } });

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, font: "Arial", size: 36, bold: true, color: C.navy })],
    ...sp(360, 120),
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.teal, space: 4 } },
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, font: "Arial", size: 28, bold: true, color: C.teal })],
    ...sp(280, 80),
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, font: "Arial", size: 24, bold: true, color: C.navy })],
    ...sp(200, 60),
  });
}
function body(text, options = {}) {
  return new Paragraph({
    children: [new TextRun({ text, font: "Arial", size: 22, color: C.darkGray, ...options })],
    ...sp(60, 60),
  });
}
function italic(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: "Arial", size: 20, italics: true, color: "888888" })],
    ...sp(40, 40),
  });
}
function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    children: [new TextRun({ text, font: "Arial", size: 22, color: C.darkGray })],
    ...sp(40, 40),
  });
}
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}
function sectionDivider(label) {
  return new Paragraph({
    children: [new TextRun({ text: `  ${label}  `, font: "Arial", size: 28, bold: true, color: C.white })],
    shading: { fill: C.navy, type: ShadingType.CLEAR },
    alignment: AlignmentType.CENTER,
    ...sp(480, 240),
  });
}

// Status badge inline
function statusRow(label, value, status) {
  // status: 'good' | 'warn' | 'bad' | 'info'
  const statusColor = status === 'good' ? C.green : status === 'warn' ? "B7770D" : status === 'bad' ? C.red : C.navy;
  const statusBg   = status === 'good' ? "EAF4EC" : status === 'warn' ? "FEF9E7" : status === 'bad' ? "FDECEA" : C.lightBlue;
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, font: "Arial", size: 22, bold: true, color: C.darkGray }),
      new TextRun({ text: ` ${value} `, font: "Arial", size: 22, color: statusColor, bold: true }),
    ],
    ...sp(40, 40),
  });
}

function field(label, value, source) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, font: "Arial", size: 22, bold: true, color: C.darkGray }),
      new TextRun({ text: value, font: "Arial", size: 22, color: value.startsWith('[') ? "999999" : C.darkGray, italics: value.startsWith('[') }),
      source ? new TextRun({ text: `  (${source})`, font: "Arial", size: 18, color: "AAAAAA" }) : new TextRun(""),
    ],
    ...sp(40, 40),
  });
}

function dataTable(rows, headerColor = C.navy) {
  const numCols = rows[0].length;
  const totalW = 9360;
  const COL = numCols === 2 ? [3200, 6160] :
               numCols === 3 ? [2800, 3480, 3080] :
               numCols === 4 ? [2340, 2340, 2340, 2340] :
               Array(numCols).fill(Math.floor(totalW / numCols));
  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: COL,
    rows: rows.map((row, i) => new TableRow({
      children: row.map((cell, j) => new TableCell({
        width: { size: COL[j], type: WidthType.DXA },
        borders: allBorders(C.midGray),
        shading: { fill: i === 0 ? headerColor : (i % 2 === 0 ? C.lightGray : C.white), type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 140, right: 140 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          children: [new TextRun({ text: cell, font: "Arial", size: 20, bold: i === 0, color: i === 0 ? C.white : C.darkGray })],
        })],
      }))
    }))
  });
}

function kpiTable(kpis) {
  const colW = Math.floor(9360 / kpis.length);
  const cols = kpis.map(() => colW);
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: cols,
    rows: [new TableRow({
      children: kpis.map(k => new TableCell({
        width: { size: colW, type: WidthType.DXA },
        borders: allBorders(C.teal),
        shading: { fill: k.highlight ? "D4EDDA" : C.lightBlue, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 140, right: 140 },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: k.label, font: "Arial", size: 18, bold: true, color: C.navy })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: k.value, font: "Arial", size: 26, bold: true, color: k.value.startsWith('[') ? "999999" : C.teal })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `(${k.source})`, font: "Arial", size: 16, color: "AAAAAA" })] }),
        ],
      }))
    })]
  });
}

function findingsTable(rows) {
  const COL = [1400, 4400, 1680, 1880];
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: COL,
    rows: rows.map((row, i) => new TableRow({
      children: row.map((cell, j) => {
        let fill = i === 0 ? C.navy : (i % 2 === 0 ? C.lightGray : C.white);
        let txtColor = i === 0 ? C.white : C.darkGray;
        if (i > 0 && j === 2) {
          if (cell === "High") { fill = "FDECEA"; txtColor = C.red; }
          else if (cell === "Medium") { fill = "FEF9E7"; txtColor = "B7770D"; }
          else if (cell === "Low") { fill = "EAF4EC"; txtColor = C.green; }
        }
        return new TableCell({
          width: { size: COL[j], type: WidthType.DXA },
          borders: allBorders(C.midGray),
          shading: { fill, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: cell, font: "Arial", size: i === 0 ? 18 : 19, bold: i === 0, color: txtColor })] })],
        });
      })
    }))
  });
}

function kwTable(rows) {
  const COL = [2800, 1560, 1560, 1560, 1880];
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: COL,
    rows: rows.map((row, i) => new TableRow({
      children: row.map((cell, j) => new TableCell({
        width: { size: COL[j], type: WidthType.DXA },
        borders: allBorders(C.midGray),
        shading: { fill: i === 0 ? C.navy : (i % 2 === 0 ? C.lightGray : C.white), type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          alignment: j > 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [new TextRun({ text: cell, font: "Arial", size: 19, bold: i === 0, color: i === 0 ? C.white : C.darkGray })],
        })],
      }))
    }))
  });
}

function spacer(n = 1) {
  return Array.from({ length: n }, () => new Paragraph({ children: [new TextRun("")], spacing: { before: 60, after: 60 } }));
}

// ── Insight callout box ────────────────────────────────────────
function insight(text, type = 'info') {
  const bg = type === 'good' ? "EAF4EC" : type === 'warn' ? "FEF9E7" : type === 'bad' ? "FDECEA" : C.lightBlue;
  const color = type === 'good' ? C.green : type === 'warn' ? "B7770D" : type === 'bad' ? C.red : C.navy;
  const prefix = type === 'good' ? "✔ " : type === 'warn' ? "⚠ " : type === 'bad' ? "✖ " : "ℹ ";
  return new Paragraph({
    children: [new TextRun({ text: prefix + text, font: "Arial", size: 21, color, bold: false })],
    shading: { fill: bg, type: ShadingType.CLEAR },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color, space: 6 } },
    indent: { left: 200, right: 200 },
    ...sp(80, 80),
  });
}

// ══════════════════════════════════════════════════════════════
const children = [

  // ── COVER ──────────────────────────────────────────────────
  ...spacer(4),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "SEO AUDIT REPORT", font: "Arial", size: 56, bold: true, color: C.navy })],
    ...sp(0, 120),
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.teal, space: 4 } },
    children: [new TextRun({ text: "Avana Plastic Surgery  ·  Avana Wellness Plus", font: "Arial", size: 28, color: C.teal })],
    ...sp(0, 240),
  }),
  ...spacer(1),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Prepared by: Javier Ferrales — SEO Specialist", font: "Arial", size: 22, color: C.darkGray })], ...sp(60, 40) }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Date: May 2026     |     Period Analyzed: Feb 14 – May 14, 2026 (3 months)", font: "Arial", size: 22, italics: true, color: "888888" })], ...sp(40, 40) }),
  ...spacer(2),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Data Sources: Google Search Console  ·  Google Analytics  ·  Semrush  ·  Authority Labs", font: "Arial", size: 19, color: "999999" })], ...sp(60, 60) }),
  pageBreak(),

  // ── REPORT SCOPE PAGE ────────────────────────────────────────
  ...spacer(2),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "WHAT THIS REPORT COVERS", font: "Arial", size: 36, bold: true, color: C.navy })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.teal, space: 4 } },
    ...sp(0, 240),
  }),
  ...spacer(1),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "This audit covers the following 8 areas for both Avana Plastic Surgery and Avana Wellness Plus", font: "Arial", size: 22, italics: true, color: "666666" })],
    ...sp(0, 240),
  }),
  ...spacer(1),

  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [400, 2200, 6760],
    rows: [
      // Header
      new TableRow({
        children: [
          new TableCell({
            width: { size: 400, type: WidthType.DXA },
            borders: allBorders(C.teal),
            shading: { fill: C.navy, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 140, right: 140 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "#", font: "Arial", size: 22, bold: true, color: C.white })] })],
          }),
          new TableCell({
            width: { size: 2200, type: WidthType.DXA },
            borders: allBorders(C.teal),
            shading: { fill: C.navy, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 140, right: 140 },
            children: [new Paragraph({ children: [new TextRun({ text: "Area", font: "Arial", size: 22, bold: true, color: C.white })] })],
          }),
          new TableCell({
            width: { size: 6760, type: WidthType.DXA },
            borders: allBorders(C.teal),
            shading: { fill: C.navy, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 140, right: 140 },
            children: [new Paragraph({ children: [new TextRun({ text: "What We Analyzed", font: "Arial", size: 22, bold: true, color: C.white })] })],
          }),
        ],
      }),
      // Row 1 - Hallazgos
      new TableRow({
        children: [
          new TableCell({
            width: { size: 400, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.teal, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "1", font: "Arial", size: 28, bold: true, color: C.white })] })],
          }),
          new TableCell({
            width: { size: 2200, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.lightBlue, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [
              new Paragraph({ children: [new TextRun({ text: "Hallazgos", font: "Arial", size: 22, bold: true, color: C.navy })] }),
              new Paragraph({ children: [new TextRun({ text: "Findings", font: "Arial", size: 18, italics: true, color: "888888" })] }),
            ],
          }),
          new TableCell({
            width: { size: 6760, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.white, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [new Paragraph({ children: [new TextRun({ text: "Key discoveries from all data sources — what is working, what is broken, and what needs immediate attention across both sites. Findings are color-coded by severity (High / Medium / Low) in each site's dedicated findings section.", font: "Arial", size: 20, color: C.darkGray })] })],
          }),
        ],
      }),
      // Row 2 - Oportunidades
      new TableRow({
        children: [
          new TableCell({
            width: { size: 400, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.teal, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "2", font: "Arial", size: 28, bold: true, color: C.white })] })],
          }),
          new TableCell({
            width: { size: 2200, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.lightGray, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [
              new Paragraph({ children: [new TextRun({ text: "Oportunidades", font: "Arial", size: 22, bold: true, color: C.navy })] }),
              new Paragraph({ children: [new TextRun({ text: "Opportunities", font: "Arial", size: 18, italics: true, color: "888888" })] }),
            ],
          }),
          new TableCell({
            width: { size: 6760, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.white, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [new Paragraph({ children: [new TextRun({ text: "Quick wins and long-term growth opportunities identified from GSC high-impression / low-CTR pages, keyword gaps vs. competitors, untapped local markets, content gaps, and Spanish-language audience potential.", font: "Arial", size: 20, color: C.darkGray })] })],
          }),
        ],
      }),
      // Row 3 - Problemas técnicos
      new TableRow({
        children: [
          new TableCell({
            width: { size: 400, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.teal, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "3", font: "Arial", size: 28, bold: true, color: C.white })] })],
          }),
          new TableCell({
            width: { size: 2200, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.lightBlue, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [
              new Paragraph({ children: [new TextRun({ text: "Problemas Técnicos", font: "Arial", size: 22, bold: true, color: C.navy })] }),
              new Paragraph({ children: [new TextRun({ text: "Technical Issues", font: "Arial", size: 18, italics: true, color: "888888" })] }),
            ],
          }),
          new TableCell({
            width: { size: 6760, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.white, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [new Paragraph({ children: [new TextRun({ text: "Full technical audit from Semrush Site Audit and GSC: crawlability, indexation errors (404s, soft 404s, redirect issues), Core Web Vitals, HTTPS, mobile usability, structured data / schema errors, internal linking issues, and duplicate content.", font: "Arial", size: 20, color: C.darkGray })] })],
          }),
        ],
      }),
      // Row 4 - Posicionamiento actual
      new TableRow({
        children: [
          new TableCell({
            width: { size: 400, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.teal, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "4", font: "Arial", size: 28, bold: true, color: C.white })] })],
          }),
          new TableCell({
            width: { size: 2200, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.lightGray, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [
              new Paragraph({ children: [new TextRun({ text: "Posicionamiento Actual", font: "Arial", size: 22, bold: true, color: C.navy })] }),
              new Paragraph({ children: [new TextRun({ text: "Current Positioning", font: "Arial", size: 18, italics: true, color: "888888" })] }),
            ],
          }),
          new TableCell({
            width: { size: 6760, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.white, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [new Paragraph({ children: [new TextRun({ text: "Current Google rankings from GSC (clicks, impressions, CTR, average position), Semrush Organic Rankings (10,877 keywords tracked), and Authority Labs daily position tracking (186 keywords). Includes branded vs. non-branded breakdown and position distribution.", font: "Arial", size: 20, color: C.darkGray })] })],
          }),
        ],
      }),
      // Row 5 - Competencia
      new TableRow({
        children: [
          new TableCell({
            width: { size: 400, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.teal, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "5", font: "Arial", size: 28, bold: true, color: C.white })] })],
          }),
          new TableCell({
            width: { size: 2200, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.lightBlue, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [
              new Paragraph({ children: [new TextRun({ text: "Competencia", font: "Arial", size: 22, bold: true, color: C.navy })] }),
              new Paragraph({ children: [new TextRun({ text: "Competition", font: "Arial", size: 18, italics: true, color: "888888" })] }),
            ],
          }),
          new TableCell({
            width: { size: 6760, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.white, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [new Paragraph({ children: [new TextRun({ text: "Top 10 organic competitors identified via Semrush (4,017 total competitors). Analysis includes keyword overlap %, estimated traffic, traffic cost value, and competitive positioning map. Key threats: cgcosmetic.com (32.1K traffic), miamiplasticsurgery.com (20.4K traffic), therealdrmiami.com (18.1K traffic).", font: "Arial", size: 20, color: C.darkGray })] })],
          }),
        ],
      }),
      // Row 6 - Contenido
      new TableRow({
        children: [
          new TableCell({
            width: { size: 400, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.teal, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "6", font: "Arial", size: 28, bold: true, color: C.white })] })],
          }),
          new TableCell({
            width: { size: 2200, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.lightGray, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [
              new Paragraph({ children: [new TextRun({ text: "Contenido", font: "Arial", size: 22, bold: true, color: C.navy })] }),
              new Paragraph({ children: [new TextRun({ text: "Content", font: "Arial", size: 18, italics: true, color: "888888" })] }),
            ],
          }),
          new TableCell({
            width: { size: 6760, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.white, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [new Paragraph({ children: [new TextRun({ text: "On-page content analysis including title tags, meta descriptions, heading structure, content quality, word count, E-E-A-T signals (critical for YMYL medical sites), image optimization, and content gaps. Includes Spanish-language content performance and missing service pages.", font: "Arial", size: 20, color: C.darkGray })] })],
          }),
        ],
      }),
      // Row 7 - Keywords
      new TableRow({
        children: [
          new TableCell({
            width: { size: 400, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.teal, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "7", font: "Arial", size: 28, bold: true, color: C.white })] })],
          }),
          new TableCell({
            width: { size: 2200, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.lightBlue, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [
              new Paragraph({ children: [new TextRun({ text: "Keywords", font: "Arial", size: 22, bold: true, color: C.navy })] }),
              new Paragraph({ children: [new TextRun({ text: "Keyword Analysis", font: "Arial", size: 18, italics: true, color: "888888" })] }),
            ],
          }),
          new TableCell({
            width: { size: 6760, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.white, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [new Paragraph({ children: [new TextRun({ text: "Keyword universe from 3 sources: GSC top queries (clicks, impressions, CTR, position), Semrush Organic Rankings (10,877 US keywords, intent distribution, traffic value $59.3K/mo), and Authority Labs position tracking (186 keywords). Includes quick wins, page-2 opportunities, and keywords not yet ranking.", font: "Arial", size: 20, color: C.darkGray })] })],
          }),
        ],
      }),
      // Row 8 - Recomendaciones
      new TableRow({
        children: [
          new TableCell({
            width: { size: 400, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.teal, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "8", font: "Arial", size: 28, bold: true, color: C.white })] })],
          }),
          new TableCell({
            width: { size: 2200, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.lightGray, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [
              new Paragraph({ children: [new TextRun({ text: "Recomendaciones Iniciales", font: "Arial", size: 22, bold: true, color: C.navy })] }),
              new Paragraph({ children: [new TextRun({ text: "Initial Recommendations", font: "Arial", size: 18, italics: true, color: "888888" })] }),
            ],
          }),
          new TableCell({
            width: { size: 6760, type: WidthType.DXA },
            borders: allBorders(C.midGray),
            shading: { fill: C.white, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 140, right: 140 },
            children: [new Paragraph({ children: [new TextRun({ text: "Actionable recommendations for each finding, organized by priority (High / Medium / Low) in each site's Findings & Recommendations section (2.8 and 3.8), and consolidated into a 5-phase Priority Action Plan with proposed timeline in Section 5.", font: "Arial", size: 20, color: C.darkGray })] })],
          }),
        ],
      }),
    ],
  }),
  ...spacer(2),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Data sources used throughout this report:", font: "Arial", size: 20, bold: true, color: C.navy })],
    ...sp(120, 60),
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Google Search Console  ·  Google Analytics 4  ·  Semrush  ·  Authority Labs", font: "Arial", size: 20, color: C.teal })],
    ...sp(40, 40),
  }),
  pageBreak(),

  // ── TABLE OF CONTENTS ───────────────────────────────────────
  h1("Table of Contents"),
  ...([
    ["1. Executive Summary", "4"],
    ["2. AVANA PLASTIC SURGERY — Full Audit", "5"],
    ["   2.1  Site Overview & KPIs", "6"],
    ["   2.2  Technical SEO Audit", "7"],
    ["   2.3  On-Page & Content Analysis", "8"],
    ["   2.4  Keyword & Ranking Analysis", "9"],
    ["   2.5  Backlink & Authority Analysis", "10"],
    ["   2.6  Competitor Analysis", "11"],
    ["   2.7  Local SEO Analysis", "12"],
    ["   2.8  Findings & Recommendations", "13"],
    ["3. AVANA WELLNESS PLUS — Full Audit", "14"],
    ["   3.1  Site Overview & KPIs", "15"],
    ["   3.2  Technical SEO Audit", "16"],
    ["   3.3  On-Page & Content Analysis", "17"],
    ["   3.4  Keyword & Ranking Analysis", "18"],
    ["   3.5  Backlink & Authority Analysis", "19"],
    ["   3.6  Competitor Analysis", "20"],
    ["   3.7  Local SEO Analysis", "21"],
    ["   3.8  Findings & Recommendations", "22"],
    ["4. Cross-Site Comparison & Shared Opportunities", "23"],
    ["5. Priority Action Plan", "24"],
  ].map(([label, pg]) => new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: 9360, leader: TabStopType.DOT }],
    children: [
      new TextRun({ text: label, font: "Arial", size: 22, color: C.darkGray }),
      new TextRun({ text: "\t" + pg, font: "Arial", size: 22, color: C.darkGray }),
    ],
    ...sp(60, 40),
  }))),
  pageBreak(),

  // ══════════════════════════════════════════════════════════
  // 1. EXECUTIVE SUMMARY
  // ══════════════════════════════════════════════════════════
  h1("1. Executive Summary"),
  body("This report presents a comprehensive SEO audit of two properties managed under the Sevenlogik portfolio: Avana Plastic Surgery (primary priority) and Avana Wellness Plus. The audit covers technical SEO, on-page optimization, keyword positioning, backlink profile, local SEO, and competitive landscape, drawing data from Google Search Console, Google Analytics, Semrush, and Authority Labs."),
  body("The analysis period covers February 14 – May 14, 2026 (3 months)."),
  ...spacer(1),

  h2("Performance Snapshot — Both Sites"),
  dataTable([
    ["Metric", "Avana Plastic Surgery", "Avana Wellness Plus", "Source"],
    ["Organic Sessions", "115,997", "772", "GA4"],
    ["GSC Clicks", "62,500", "558", "GSC"],
    ["GSC Impressions", "1,620,000", "72,000", "GSC"],
    ["Average CTR", "3.9%", "0.8%", "GSC"],
    ["Average Position", "14.4", "17.7", "GSC"],
    ["Engagement Rate", "52.13%", "51.42%", "GA4"],
    ["Avg. Engagement Time", "1m 10s", "54s", "GA4"],
    ["Key Events / Conversions (Organic)", "8,143", "0 — not configured", "GA4"],
    ["Session Key Event Rate", "3.25%", "0%", "GA4"],
    ["Total Site Pages", "~1,751", "~61", "GSC"],
    ["Pages Indexed", "1,010", "~51", "GSC"],
    ["Site Health Score", "90%", "Pending — plan renewal", "Semrush"],
    ["Domain Authority Score", "29", "Pending — plan renewal", "Semrush"],
  ]),
  ...spacer(1),

  h2("Key Findings — Avana Plastic Surgery"),
  insight("Strong brand dominance — 'avana plastic surgery' ranks #1 with 19,800 clicks — but 90%+ of traffic is branded. Non-branded procedure keywords are severely underperforming.", "warn"),
  insight("741 pages not indexed (vs. 1,010 indexed) including 212 returning 404 errors and 314 crawled-but-not-indexed. Critical technical issue affecting crawl budget and rankings.", "bad"),
  insight("1,243 internal links have nofollow attributes — actively blocking PageRank from flowing to procedure pages. Major ranking suppressor.", "bad"),
  insight("High-value pages nearly invisible: BBL Miami (126,985 impressions, 0.97% CTR), Tummy Tuck Miami (48,210 impressions, 1.08% CTR). Moving these to page 1 is the fastest traffic win.", "warn"),
  insight("Financing pages drive 41% of all organic conversions — a major strategic insight. Financing CTAs should be added to every procedure page.", "good"),
  insight("'lipo 360' ranks #1 with 33,100 monthly searches — the most valuable non-branded keyword asset. Must be protected and expanded.", "good"),
  insight("Referring domains declining from ~817 to ~521 over 12 months — link equity is eroding. Active link building campaign needed urgently.", "bad"),
  ...spacer(1),

  h2("Key Findings — Avana Wellness Plus"),
  insight("Site generates only 558 GSC clicks and 772 organic sessions vs Plastic Surgery's 62,500 clicks and 115,997 sessions — a 150x traffic gap representing the portfolio's biggest growth opportunity.", "bad"),
  insight("Only ~61 total pages indexed — critically underdeveloped for a medical wellness clinic. Content expansion is the single highest-leverage action for this site.", "bad"),
  insight("Zero conversion tracking configured in GA4. No Key Events set up — the team has no visibility into how many leads the site generates. Must be fixed immediately.", "bad"),
  insight("Spanish-language pages consistently outperform English equivalents — Spanish wart removal (54 clicks) vs English (10 clicks). Spanish-first content strategy recommended.", "good"),
  insight("Keloid removal is the #1 quick win — 3 related queries hovering at position 9–11, all near page 1. One focused optimization push could move all three simultaneously.", "warn"),
  insight("Immigration medical exam is a low-competition niche service with strong local intent signals — a unique opportunity to dominate a specific high-value vertical.", "good"),
  insight("Semrush subscription payment failed — renewal required before full technical audit, backlink analysis, and keyword tracking can be completed for Wellness Plus.", "bad"),
  ...spacer(1),

  h2("Immediate Priorities for Monday's Meeting"),
  bullet("Fix Semrush payment — renew subscription to unlock full audit capabilities for Wellness Plus"),
  bullet("Set up GA4 Key Events for Avana Wellness Plus — cannot measure anything without this"),
  bullet("Fix 212 x 404 errors on Plastic Surgery — highest impact technical fix"),
  bullet("Rewrite title tags on BBL Miami, Tummy Tuck Miami, Mommy Makeover Miami — fastest CTR improvement"),
  bullet("Set up Authority Labs tracking for Wellness Plus — start measuring keyword positions from today"),
  bullet("Add financing CTAs to all Plastic Surgery procedure pages — leverage the 41% conversion insight"),
  pageBreak(),

  // ══════════════════════════════════════════════════════════
  // 2. AVANA PLASTIC SURGERY
  // ══════════════════════════════════════════════════════════
  sectionDivider("SECTION 2 — AVANA PLASTIC SURGERY"),
  ...spacer(1),
  h1("2. Avana Plastic Surgery — Full SEO Audit"),
  field("Website URL", "https://avanaplasticsurgery.com", "GSC"),
  field("Audit Period", "Feb 14 – May 14, 2026 (3 months)", "GSC"),
  field("Data Last Updated", "~3.5–4 hours before screenshots", "GSC"),
  pageBreak(),

  // 2.1
  h2("2.1 Site Overview & Key Performance Indicators"),
  italic("Data source: Google Search Console — Performance > Search Results (3 months)"),
  ...spacer(1),

  h3("GSC Performance KPIs"),
  kpiTable([
    { label: "Total Clicks", value: "62,500", source: "GSC" },
    { label: "Total Impressions", value: "1,620,000", source: "GSC" },
    { label: "Average CTR", value: "3.9%", source: "GSC" },
    { label: "Average Position", value: "14.4", source: "GSC" },
  ]),
  ...spacer(1),

  kpiTable([
    { label: "Organic Sessions", value: "115,997", source: "GA4" },
    { label: "Engagement Rate", value: "52.13%", source: "GA4" },
    { label: "Avg. Engagement Time", value: "1m 10s", source: "GA4" },
    { label: "Session Key Event Rate", value: "3.25%", source: "GA4" },
  ]),
  ...spacer(1),
  kpiTable([
    { label: "Engaged Sessions", value: "60,473", source: "GA4" },
    { label: "Key Events (Conversions)", value: "8,143", source: "GA4" },
    { label: "Organic Share of Total Sessions", value: "47.96%", source: "GA4" },
    { label: "Total Site Sessions", value: "241,838", source: "GA4" },
  ]),
  ...spacer(1),
  insight("Organic Search is the #1 traffic driver — 47.96% of all sessions (115,997 out of 241,838). This confirms SEO is the most critical acquisition channel for this site.", "good"),
  insight("Engagement Rate of 52.13% and Avg. Engagement Time of 1m 10s are solid for a medical site. Users who land organically are reading and engaging with content.", "good"),
  insight("8,143 Key Events attributed to Organic Search (3.25% session key event rate). Note: confirm in GA4 what actions are configured as Key Events — typically form submissions, phone clicks, appointment requests.", "info"),
  ...spacer(1),

  h3("Channel Comparison — All Traffic Sources"),
  dataTable([
    ["Channel", "Sessions", "% of Total", "Engagement Rate", "Key Events", "Key Event Rate"],
    ["Organic Search", "115,997", "47.96%", "52.13%", "8,143", "3.25%"],
    ["Direct", "52,777", "21.82%", "45.01%", "7,221", "6.20%"],
    ["Organic Social", "51,843", "21.44%", "51.46%", "2,314", "2.44%"],
    ["Paid Search", "10,973", "4.54%", "81.33%", "209", "0.91%"],
    ["Email", "4,125", "1.71%", "41.55%", "54", "0.63%"],
    ["Referral", "649", "0.27%", "64.71%", "30", "2.00%"],
    ["TOTAL (All Channels)", "241,838", "100%", "50.72%", "18,137", "3.51%"],
  ]),
  ...spacer(1),
  insight("Paid Search has the highest engagement rate (81.33%) but only 0.91% key event rate and 209 conversions from 10,973 sessions — very low ROI compared to Organic Search. Worth flagging to the team.", "warn"),
  insight("Direct traffic (52,777 sessions, 6.2% key event rate) converts at nearly double the rate of Organic Search — suggesting returning patients or referral-driven brand searches.", "info"),
  ...spacer(1),

  h3("Traffic Trend Analysis"),
  body("Over the 3-month period (Feb 14 – May 14, 2026), Organic Search sessions were stable at approximately 1,200–1,400 sessions/day based on the GA4 trend graph, with no major drops or spikes indicating good stability. Total daily sessions peaked around 3,000–5,000 across all channels. No algorithm update penalties are evident."),
  insight("Opportunity: The gap between impressions (1.62M) and clicks (62.5K) with a 3.9% CTR indicates many keywords rank in positions where users see the site but don't click. Improving positions from 5–15 to top 3 would significantly increase CTR and clicks.", "warn"),
  ...spacer(1),

  h3("Top Landing Pages by Clicks (GSC — 3 months)"),
  dataTable([
    ["Page URL", "Clicks", "Impressions"],
    ["avanaplasticsurgery.com/ (Homepage)", "26,573", "235,001"],
    ["avanaplasticsurgery.com/dallas-texas", "8,560", "89,935"],
    ["avanaplasticsurgery.com/dr-algird-mameniskis", "2,206", "31,420"],
    ["avanaplasticsurgery.com/dr-abdul-shararah", "1,368", "23,217"],
    ["avanaplasticsurgery.com/brazilian-butt-lift-miami", "1,234", "126,985"],
    ["avanaplasticsurgery.com/before-and-after", "1,220", "70,073"],
    ["avanaplasticsurgery.com/mommy-makeover-miami", "1,176", "43,888"],
    ["avanaplasticsurgery.com/dr-stephanie-luster", "1,105", "16,951"],
    ["avanaplasticsurgery.com/specials", "982", "61,995"],
    ["avanaplasticsurgery.com/dr-shane-mcdaniel", "806", "12,685"],
    ["avanaplasticsurgery.com/espanol/lipo-360-en-miami", "625", "49,403"],
    ["avanaplasticsurgery.com/dr-mark-schusterman", "552", "6,501"],
    ["avanaplasticsurgery.com/dr-dominick-golio", "529", "5,672"],
    ["avanaplasticsurgery.com/tummy-tuck-miami", "522", "48,210"],
    ["avanaplasticsurgery.com/out-of-town-patients", "511", "57,318"],
    ["avanaplasticsurgery.com/medical-staff", "490", "63,841"],
    ["avanaplasticsurgery.com/locations", "478", "73,077"],
  ]),
  ...spacer(1),
  insight("Key observation: The Brazilian Butt Lift Miami page has 126,985 impressions but only 1,234 clicks — a 0.97% CTR. This is a high-volume page with likely low ranking positions that represents a major quick-win opportunity.", "warn"),
  insight("Similarly, /out-of-town-patients (57,318 impressions, 511 clicks = 0.89% CTR) and /medical-staff (63,841 impressions, 490 clicks = 0.77% CTR) show very low CTR suggesting poor positions or weak meta titles.", "warn"),

  h3("Conversion & Goal Performance"),
  field("Primary Conversion Event", "Contact Form Submitted", "GA4"),
  field("Total Form Submissions (All Channels)", "~9,548", "GA4"),
  field("Key Events from Organic Search", "8,143 (44.9% of total)", "GA4"),
  field("Session Key Event Rate (Organic)", "3.25%", "GA4"),
  field("get_direction Events (Local intent signals)", "531 total", "GA4"),
  ...spacer(1),
  dataTable([
    ["Event Name", "Total Count", "Total Users", "Notes"],
    ["page_view", "641,389", "140,736", "All page views"],
    ["user_engagement", "414,236", "71,184", "Active engagement events"],
    ["session_start", "241,537", "140,606", "Matches total sessions"],
    ["scroll", "197,063", "91,330", "Scroll depth tracking"],
    ["first_visit", "135,155", "135,287", "New user visits"],
    ["click", "11,777", "9,919", "Outbound / internal clicks"],
    ["Contact Form Submitted", "9,548", "6,979", "PRIMARY CONVERSION EVENT"],
    ["contact_form_submitted", "9,544", "6,974", "DUPLICATE — same event, fix needed"],
    ["get_direction", "531", "496", "Local SEO intent signal"],
    ["view_search_results", "3", "3", "Minimal — internal search"],
  ]),
  ...spacer(1),
  insight("Organic Search drives 44.9% of ALL conversions (8,143 of 18,137 key events) — confirming SEO as the single highest-impact acquisition channel for Avana Plastic Surgery.", "good"),
  insight("TRACKING BUG — URGENT: 'Contact Form Submitted' and 'contact_form_submitted' are the same event firing twice (capital vs. lowercase). This duplicates conversion data and distorts reporting across all channels. Must be fixed in GA4 immediately.", "bad"),
  insight("531 get_direction events signal strong local intent — users actively looking up directions to Avana locations. Reinforces the importance of GBP and local SEO optimization for both Miami and Dallas.", "info"),
  field("Top Converting Pages (Organic breakdown)", "See table below — GA4 Pages and Screens filtered by Organic Search", "GA4"),
  ...spacer(1),

  h3("Top Pages by Key Events — Organic Search Only (Feb 14 – May 14, 2026)"),
  italic("Filter: Session primary channel group = Organic Search | Sorted by Key Events | 1,190 total pages"),
  ...spacer(1),
  kpiTable([
    { label: "Total Organic Views", value: "332,256", source: "GA4" },
    { label: "Total Active Users", value: "46,930", source: "GA4" },
    { label: "Total Key Events", value: "8,143", source: "GA4" },
    { label: "Avg. Engagement Time", value: "2m 54s", source: "GA4" },
  ]),
  ...spacer(1),
  dataTable([
    ["Page", "Views", "Active Users", "Key Events", "% of Total KE"],
    ["/financing-option/alphaeon-credit", "2,077", "1,289", "1,876", "23.04%"],
    ["/financing-option/medloanfinance", "1,653", "1,073", "1,214", "14.91%"],
    ["/contact", "2,341", "1,506", "999", "12.27%"],
    ["/dallas-texas", "15,420", "6,005", "395", "4.85%"],
    ["/specials", "20,299", "10,006", "363", "4.46%"],
    ["/financing-option/unitedcredit", "363", "260", "271", "3.33%"],
    ["/ (Homepage)", "70,124", "20,441", "229", "2.81%"],
    ["/special/lipo-360-plus-bbl-with-dr-shusterman/637", "1,211", "864", "220", "2.70%"],
    ["/financing-options", "11,408", "6,381", "217", "2.66%"],
    ["/special/combo-bbl-tummy-tuck-breast-lift-dr-mameniskis/625", "772", "596", "88", "1.08%"],
  ]),
  ...spacer(1),
  insight("CRITICAL FINDING: Financing pages drive 41% of ALL organic key events (1,876 + 1,214 + 271 = 3,361 of 8,143 total). This reveals that users who convert organically are heavily motivated by financing options — Avana's financing content is a major conversion driver that should be prominently featured across all procedure pages.", "good"),
  insight("The /contact page generates 999 key events (12.27%) from organic — confirming that users landing on the site organically are actively seeking to get in touch. This makes optimizing the contact page experience and its internal linking a high priority.", "good"),
  insight("The homepage (/) receives 70,124 views — the most of any page — but only 229 key events (2.81%). This low conversion rate on the highest-traffic page suggests the homepage is not effectively funneling organic visitors toward a conversion action. A stronger CTA strategy on the homepage is needed.", "warn"),
  insight("Specials page (/specials) drives 363 key events with 20,299 views — users are clearly motivated by promotional offers. Keeping this page fresh with active specials and ensuring it ranks well for 'plastic surgery specials miami' type queries is a worthwhile ongoing effort.", "info"),
  insight("Two procedure-specific special pages rank in the top 10 converters: Lipo 360 + BBL with Dr. Shusterman (220 KE) and Combo BBL + Tummy Tuck with Dr. Mameniskis (88 KE). This confirms that surgeon-specific procedure combination pages convert well — a content format worth expanding.", "info"),
  pageBreak(),

  // 2.2 Technical
  h2("2.2 Technical SEO Audit"),
  italic("Data source: GSC — Index Coverage, Core Web Vitals, Enhancements + Semrush Site Audit (May 10, 2026)"),
  ...spacer(1),

  h3("Semrush Site Health Overview"),
  kpiTable([
    { label: "Site Health Score", value: "90%", source: "Semrush" },
    { label: "Top-10% Avg. Score", value: "92%", source: "Semrush" },
    { label: "Total Errors", value: "8", source: "Semrush" },
    { label: "Total Warnings", value: "1,763", source: "Semrush" },
  ]),
  ...spacer(1),
  kpiTable([
    { label: "Crawlability", value: "100%", source: "Semrush" },
    { label: "HTTPS Score", value: "98%", source: "Semrush" },
    { label: "Internal Linking", value: "87%", source: "Semrush" },
    { label: "Markup Score", value: "98%", source: "Semrush" },
  ]),
  ...spacer(1),
  insight("Site Health of 90% is good but below the top-10% benchmark of 92%. The 1,763 warnings — primarily driven by 311 low text-HTML pages and 1,243 nofollow internal links — are the main drag pulling the score down.", "warn"),
  ...spacer(1),

  h3("Semrush Site Audit — Errors (5 types, 8 total)"),
  italic("Errors are the highest severity issues — fix immediately."),
  dataTable([
    ["Error", "Pages Affected", "Priority"],
    ["2 internal images are broken", "2", "🔴 Fix immediately"],
    ["2 pages have duplicate meta descriptions", "2", "🔴 Fix immediately"],
    ["2 structured data items are invalid", "2", "🔴 Fix immediately"],
    ["1 page couldn't be crawled", "1", "🔴 Fix immediately"],
    ["1 incorrect page found in sitemap.xml", "1", "🔴 Fix immediately"],
  ]),
  ...spacer(1),

  h3("Semrush Site Audit — Warnings (3 types, 1,763 total)"),
  italic("Warnings are medium severity — address within 30 days."),
  dataTable([
    ["Warning", "Pages Affected", "New Issues", "Priority"],
    ["1,243 outgoing internal links contain nofollow attribute", "1,243 links", "49 new", "🟠 High"],
    ["311 pages have low text-to-HTML ratio", "311 pages", "21 new", "🟠 High"],
    ["209 pages have title tags that are too long", "209 pages", "1 new", "🟠 High"],
  ]),
  ...spacer(1),
  insight("CRITICAL: 1,243 internal links have nofollow attributes — this is actively blocking PageRank from flowing through the site's internal link structure. Internal links should almost never be nofollow. This needs immediate review and correction.", "bad"),
  insight("311 pages with low text-to-HTML ratio is a major content quality signal. This aligns with the 314 'crawled but not indexed' pages from GSC — Google is likely seeing these as thin content pages.", "bad"),
  insight("209 title tags are too long (>60 characters). These will be truncated in search results, reducing CTR. Cross-references with the low CTR pages identified in GSC (BBL, tummy tuck, etc.).", "warn"),
  ...spacer(1),

  h3("Semrush Site Audit — Notices (9 types)"),
  italic("Notices are lower severity — address within 90 days or as part of broader fixes."),
  dataTable([
    ["Notice", "Affected", "New Issues"],
    ["503 outgoing external links contain nofollow attributes", "503 links", "27 new"],
    ["493 links to external pages returned 403 HTTP status", "493 links", "27 new"],
    ["74 pages have only 1 incoming internal link", "74 pages", "—"],
    ["44 resources are formatted as page links", "44 resources", "6 new"],
    ["11 pages require content optimization", "11 pages", "2 new"],
    ["3 links have no anchor text", "3 links", "1 new"],
    ["2 subdomains don't support HSTS", "2 subdomains", "—"],
    ["llms.txt not found", "Site-wide", "—"],
    ["1 link has non-descriptive anchor text", "1 link", "—"],
  ]),
  ...spacer(1),
  insight("493 external links returning 403 errors means nearly 500 outbound links on the site are pointing to blocked or forbidden pages — these create a poor user experience and waste crawl resources.", "warn"),
  insight("74 pages with only 1 internal link are at risk of being treated as orphan pages by Google. These pages receive very little PageRank and are unlikely to rank well regardless of content quality.", "warn"),
  kpiTable([
    { label: "Pages Indexed", value: "1,010", source: "GSC" },
    { label: "Pages NOT Indexed", value: "741", source: "GSC" },
    { label: "Semrush Site Health", value: "90%", source: "Semrush" },
    { label: "Semrush Errors / Warnings", value: "8 / 1,763", source: "Semrush" },
  ]),
  ...spacer(1),

  dataTable([
    ["Reason Not Indexed", "Pages", "Source", "Severity"],
    ["Not found (404)", "212", "Website", "🔴 Critical"],
    ["Crawled — currently not indexed", "314", "Google Systems", "🟠 High"],
    ["Duplicate, Google chose different canonical", "97", "Google Systems", "🟡 Medium"],
    ["Page with redirect (failed validation)", "19", "Website", "🔴 Critical"],
    ["Alternate page with proper canonical tag", "79", "Website", "🟡 Medium"],
    ["Excluded by 'noindex' tag", "5", "Website", "🟡 Review"],
    ["Soft 404", "4", "Website", "🟠 High"],
    ["Server error (5xx)", "1", "Website", "🔴 Critical"],
    ["Discovered — currently not indexed", "10", "Google Systems", "🟠 High"],
    ["Redirect error", "0", "Website", "✅ None"],
  ]),
  ...spacer(1),
  insight("CRITICAL: 212 pages return 404 errors. These are broken pages that damage crawl budget, user experience, and link equity. All must be audited and either redirected (301) or restored.", "bad"),
  insight("CRITICAL: 314 pages are 'Crawled but not indexed' — Google visited them but decided not to index them. This typically signals thin content, duplicate content, or low-quality pages. Each needs review.", "bad"),
  insight("19 pages with redirects failed Google's validation — redirect chains or loops likely. Fix immediately.", "bad"),
  ...spacer(1),

  field("Sitemap Submitted & Valid", "[ Confirm in GSC — Sitemaps section ]", "GSC"),
  field("Robots.txt Status", "[ Confirm accessible at avanaplasticsurgery.com/robots.txt ]", "Manual check"),
  ...spacer(1),

  h3("Core Web Vitals"),
  italic("Data source: GSC — Experience > Core Web Vitals (last 3 months)"),
  ...spacer(1),
  dataTable([
    ["Device", "Good URLs", "Need Improvement", "Poor URLs", "Status"],
    ["Desktop", "750", "0", "0", "✅ PASS"],
    ["Mobile", "680", "70", "0", "⚠️ PARTIAL"],
  ]),
  ...spacer(1),
  insight("Desktop CWV: Fully passing — all 750 URLs rated Good. Excellent performance.", "good"),
  insight("Mobile CWV: 70 URLs have a CLS (Cumulative Layout Shift) issue > 0.1. CLS measures visual stability — elements are shifting unexpectedly on mobile. This is likely caused by images or embeds without defined dimensions, or dynamically injected content.", "warn"),
  body("CLS Issue Detail (Mobile):"),
  bullet("70 URLs: CLS > 0.1 (Need Improvement threshold) — validation not yet started"),
  bullet("0 URLs: CLS > 0.25 (Poor threshold)"),
  bullet("Recommended fix: Add explicit width/height attributes to all images and iframes. Avoid inserting content above existing content. Reserve space for ads or dynamic elements."),
  ...spacer(1),

  h3("HTTPS & Security"),
  field("SSL Certificate Valid", "[ Confirm — site loads on HTTPS ]", "Manual"),
  field("HTTP → HTTPS Redirect", "[ Fill from Semrush Audit ]", "Semrush"),
  field("Mixed Content Issues", "[ Fill from Semrush Audit ]", "Semrush"),
  ...spacer(1),

  h3("Mobile Friendliness"),
  field("Mobile Usability Issues (GSC)", "[ Fill — GSC > Experience > Mobile Usability ]", "GSC"),
  body("Note: CWV mobile CLS issues (70 URLs) also affect mobile experience. See Core Web Vitals section above."),
  ...spacer(1),

  h3("Structured Data / Schema Markup"),
  italic("Data source: GSC — Enhancements section"),
  ...spacer(1),
  dataTable([
    ["Schema Type", "Valid Items", "Invalid Items", "Status"],
    ["FAQ", "10", "0", "✅ Valid"],
    ["Profile Page", "22", "0", "✅ Valid"],
    ["Review Snippets", "8", "0", "✅ Valid"],
    ["Videos", "112", "0", "✅ Valid (with warnings)"],
  ]),
  ...spacer(1),
  insight("Schema implementation is active and healthy across 4 types. No critical errors detected. This is a strength — rich results are eligible for FAQ, Reviews, and Videos.", "good"),
  insight("Video schema warning: 83 video items have 'uploadDate' missing a timezone and invalid datetime format. Fix by adding timezone offset (e.g. 2026-01-15T10:00:00+00:00) to all uploadDate fields.", "warn"),
  insight("Opportunity: MedicalBusiness, LocalBusiness, BreadcrumbList, and MedicalProcedure schema are not yet detected. Adding these could unlock additional rich result types and reinforce E-E-A-T for Google.", "info"),
  ...spacer(1),

  h3("Internal Linking"),
  field("Pages with Only 1 Internal Link", "74 pages", "Semrush"),
  field("Internal Links with Nofollow (blocking PageRank)", "1,243 links", "Semrush"),
  field("Broken Internal Images", "2", "Semrush"),
  field("Broken Internal Links", "[ Confirm full count in Semrush — Site Audit > Issues ]", "Semrush"),
  field("Internal Linking Score", "87%", "Semrush"),
  body("The 1,243 nofollow internal links are the most critical internal linking issue — they are actively preventing PageRank from flowing to important procedure and location pages. All internal nofollow attributes should be audited and removed unless specifically intentional."),
  pageBreak(),

  // 2.3 On-Page
  h2("2.3 On-Page & Content Analysis"),
  italic("Data source: Semrush On-Page SEO Checker + manual review"),
  ...spacer(1),

  h3("Title Tags & Meta Descriptions"),
  dataTable([
    ["Issue", "Count", "Priority"],
    ["Missing Title Tags", "[ Semrush — check Issues tab ]", "🔴 Critical"],
    ["Duplicate Title Tags", "2 pages", "🔴 Critical"],
    ["Title Tags Too Long (>60 chars)", "209 pages", "🟠 High"],
    ["Title Tags Too Short (<30 chars)", "[ Semrush ]", "🟡 Medium"],
    ["Missing Meta Descriptions", "[ Semrush ]", "🟠 High"],
    ["Duplicate Meta Descriptions", "2 pages", "🔴 Critical"],
    ["Meta Descriptions Too Long (>160 chars)", "[ Semrush ]", "🟡 Medium"],
  ]),
  ...spacer(1),
  insight("From GSC: Multiple pages with very low CTR (e.g. BBL Miami 0.97%, /out-of-town-patients 0.89%) likely have weak or generic title tags not optimized for the query intent. Rewriting these is a high-priority quick win.", "warn"),
  ...spacer(1),

  h3("Heading Structure (H1–H6)"),
  field("Pages Missing H1", "[ Fill from Semrush ]", "Semrush"),
  field("Pages with Multiple H1s", "[ Fill from Semrush ]", "Semrush"),
  body("[ Note whether heading hierarchy supports keyword targeting on procedure pages. ]"),
  ...spacer(1),

  h3("Content Quality Assessment"),
  body("[ Complete after reviewing key pages manually. For each procedure page note: word count, primary keyword usage, FAQ integration, CTA strength, and content freshness. ]"),
  dataTable([
    ["Page", "Est. Word Count", "Primary KW in H1?", "Has FAQ?"],
    ["Homepage", "[ Fill ]", "[ Yes/No ]", "[ Yes/No ]"],
    ["Brazilian Butt Lift Miami", "[ Fill ]", "[ Yes/No ]", "[ Yes/No ]"],
    ["Tummy Tuck Miami", "[ Fill ]", "[ Yes/No ]", "[ Yes/No ]"],
    ["Mommy Makeover Miami", "[ Fill ]", "[ Yes/No ]", "[ Yes/No ]"],
    ["Dallas Texas Location Page", "[ Fill ]", "[ Yes/No ]", "[ Yes/No ]"],
  ]),
  ...spacer(1),

  h3("E-E-A-T Signals — Critical for Medical / YMYL Site"),
  bullet("Doctor bios with credentials present: [ Yes / No / Partial — check /medical-staff page ]"),
  bullet("Board certifications displayed per doctor: [ Yes / No ]"),
  bullet("Before & after galleries with consent disclaimers: [ Yes / Partial — /before-and-after has 1,220 clicks ]"),
  bullet("Patient reviews / testimonials integrated with schema: Yes — Review Snippets schema active (8 valid)"),
  bullet("Medical disclaimer / privacy policy present: [ Confirm ]"),
  bullet("YMYL compliance: Site must clearly establish expertise, authoritativeness, and trustworthiness on all procedure pages. Google holds medical sites to the highest E-E-A-T standards."),
  ...spacer(1),

  h3("Image Optimization"),
  field("Images Missing ALT Text", "[ Fill from Semrush ]", "Semrush"),
  field("Oversized Images", "[ Fill from Semrush / PageSpeed ]", "Semrush"),
  field("Modern Formats (WebP/AVIF)", "[ Fill from PageSpeed ]", "PageSpeed"),
  pageBreak(),

  // 2.4 Keywords
  h2("2.4 Keyword & Ranking Analysis"),
  italic("Data source: GSC Queries + Semrush Organic Rankings (May 14, 2026) — US market, Desktop"),
  ...spacer(1),

  h3("Semrush Organic Overview"),
  kpiTable([
    { label: "Total Keywords Ranked", value: "10,877", source: "Semrush" },
    { label: "Estimated Monthly Traffic", value: "22,600", source: "Semrush" },
    { label: "Traffic Cost Value", value: "$59,300/mo", source: "Semrush" },
    { label: "Also Ranked (CA + MX)", value: "CA: 277 | MX: 245", source: "Semrush" },
  ]),
  ...spacer(1),

  h3("Keyword Intent Distribution"),
  dataTable([
    ["Intent Type", "% of Keywords", "Assessment"],
    ["Informational", "62%", "High — users researching, not yet ready to convert"],
    ["Transactional", "21%", "Good — commercial/booking intent keywords"],
    ["Commercial", "10%", "Medium — comparison/consideration stage"],
    ["Navigational", "7%", "Brand searches — users looking for Avana specifically"],
  ]),
  ...spacer(1),
  insight("62% of ranked keywords are Informational intent — this means the site ranks heavily for research-stage queries. While valuable for awareness, the priority should be growing the Transactional (21%) and Commercial (10%) keyword base where users are closer to booking a procedure.", "warn"),
  ...spacer(1),

  h3("Top Keyword Rankings — Semrush Positions (May 14, 2026)"),
  kwTable([
    ["Keyword", "Position", "Volume/mo", "KD", "Traffic %"],
    ["avana plastic surgery", "1", "9,900", "40", "34.98%"],
    ["avana", "1", "6,600", "37", "7.22%"],
    ["avana plastic surgery photos", "1", "590", "26", "2.08%"],
    ["avana plastic surgery miami", "1", "590", "38", "2.08%"],
    ["lipo 360", "1", "33,100", "21", "1.75%"],
    ["avana plastic surgery dallas", "1", "320", "11", "1.13%"],
    ["avana plastic surgery dallas tx", "1", "260", "21", "0.91%"],
    ["havana plastic surgery", "1", "260", "39", "0.91%"],
    ["avana plastic surgery portal", "1", "260", "13", "0.91%"],
    ["avana plastic", "1", "260", "34", "0.91%"],
  ]),
  ...spacer(1),
  insight("MAJOR FINDING: 'lipo 360' ranks #1 with 33,100 monthly searches and KD of only 21 — this is the single most valuable non-branded keyword the site owns. It drives 1.75% of traffic despite competing with 10K volume terms. Protecting and expanding this ranking (related pages: lipo 360 miami, lipo 360 before and after, lipo 360 cost) is a top priority.", "good"),
  insight("Almost all top-10 positions are branded keywords. The site dominates its own brand but has very limited non-branded ranking power — 'lipo 360' is the main exception. This confirms the critical need to build non-branded procedure keyword rankings.", "warn"),
  ...spacer(1),

  h3("GSC Top Queries by Clicks (3 months)"),
  kwTable([
    ["Query", "Clicks", "Impressions", "CTR", "Avg Pos"],
    ["avana plastic surgery", "19,800", "44,317", "44.7%", "~1"],
    ["avana plastic surgery dallas", "4,285", "11,781", "36.4%", "~1–3"],
    ["avana plastic surgery miami", "1,782", "4,682", "38.1%", "~1–3"],
    ["avana plastic surgery photos", "620", "2,166", "28.6%", "~2–4"],
    ["dr mameniskis", "552", "1,402", "39.4%", "~1–2"],
    ["avana plastic surgery reviews", "336", "8,706", "3.9%", "~8–12"],
    ["mommy makeover miami", "187", "4,933", "3.8%", "~10–15"],
    ["tummy tuck miami", "522", "48,210", "1.08%", "~15–20"],
    ["brazilian butt lift miami", "1,234", "126,985", "0.97%", "~15–20"],
    ["lipo 360 miami (espanol)", "625", "49,403", "1.27%", "~15–20"],
  ]),
  ...spacer(1),

  h3("High-Priority Keyword Opportunities"),
  dataTable([
    ["Keyword", "GSC Impressions", "Current CTR", "Semrush Vol", "Opportunity"],
    ["brazilian butt lift miami", "126,985", "0.97%", "[ Check Semrush ]", "🔴 Massive — likely p.2+"],
    ["tummy tuck miami", "48,210", "1.08%", "[ Check Semrush ]", "🔴 High — very low CTR"],
    ["lipo 360 miami", "49,403", "1.27%", "[ Check Semrush ]", "🔴 High — Spanish + English"],
    ["mommy makeover miami", "43,888", "2.68%", "[ Check Semrush ]", "🟠 Medium — ranking ~10–15"],
    ["avana plastic surgery reviews", "8,706", "3.86%", "[ Check Semrush ]", "🟠 Quick win — near p.1"],
    ["lipo 360", "[ GSC ]", "[ GSC ]", "33,100", "🟢 Already #1 — protect & expand"],
  ]),
  ...spacer(1),

  h3("Authority Labs — Keyword Position Tracking (Miami, FL — May 1, 2026)"),
  italic("Data source: Authority Labs export — 186 keywords tracked for avanaplasticsurgery.com, Miami FL 33174, Mobile, en-us"),
  ...spacer(1),

  kpiTable([
    { label: "Total Keywords Tracked", value: "186", source: "Authority Labs" },
    { label: "Positions 1–3 (Strong)", value: "40 keywords", source: "Authority Labs" },
    { label: "Positions 4–10 (Quick Wins)", value: "22 keywords", source: "Authority Labs" },
    { label: "Positions 11–20 (Page 2)", value: "29 keywords", source: "Authority Labs" },
  ]),
  ...spacer(1),
  kpiTable([
    { label: "Not Currently Ranking", value: "42 keywords", source: "Authority Labs" },
    { label: "Remaining (pos 21–50+)", value: "53 keywords", source: "Authority Labs" },
    { label: "Tracked Since", value: "Oct 15, 2018", source: "Authority Labs" },
    { label: "Report Date", value: "May 1, 2026", source: "Authority Labs" },
  ]),
  ...spacer(1),

  h3("Positions 1–3 — Strong Rankings (Top Performers)"),
  dataTable([
    ["Keyword", "Google Position", "Monthly Volume", "CPC"],
    ["avana plastic surgery", "1", "14,800", "$4.64"],
    ["tummy tuck miami", "3", "1,900", "$11.38"],
    ["mommy makeover miami", "2", "1,600", "$8.46"],
    ["brazilian butt lift miami", "2", "1,300", "$9.01"],
    ["bbl in miami", "3", "1,300", "$9.00"],
    ["lipo 360 miami", "2", "1,000", "$8.94"],
    ["bbl cost in miami", "3", "590", "$7.76"],
    ["mommy makeover cost in miami", "1", "320", "$7.02"],
    ["mommy makeover florida", "1", "320", "$11.53"],
    ["breast augmentation cost in miami", "3", "320", "$6.51"],
    ["hourglass tummy tuck miami", "2", "40", "$0.00"],
    ["bichectomy miami", "1", "20", "$0.00"],
    ["transumbilical breast augmentation miami", "1", "10", "$0.00"],
    ["bbl revision miami", "2", "10", "$3.49"],
    ["arm lift cost in miami", "3", "10", "$7.78"],
  ]),
  ...spacer(1),
  insight("Strong position 1–3 rankings for high-value commercial keywords: tummy tuck miami ($11.38 CPC), mommy makeover miami ($8.46 CPC), and brazilian butt lift miami ($9.01 CPC) confirm Avana is competitive for the highest-value procedure terms in Miami. These rankings must be protected and expanded.", "good"),
  insight("IMPORTANT DISCREPANCY: Authority Labs shows 'brazilian butt lift miami' at position 2, but GSC shows only 0.97% CTR with 126,985 impressions. This suggests the ranking may fluctuate significantly — Authority Labs captures one daily snapshot while GSC averages across all searches over 3 months. The true average position is likely much lower than 2.", "warn"),
  ...spacer(1),

  h3("Positions 4–10 — Quick Win Opportunities"),
  dataTable([
    ["Keyword", "Google Position", "Monthly Volume", "CPC"],
    ["lymphatic drainage massage miami", "7", "1,600", "$2.24"],
    ["breast lift miami", "5", "590", "$6.29"],
    ["lipo cost miami", "4", "320", "$7.92"],
    ["liposuction miami cost", "4", "320", "$7.92"],
    ["hourglass tummy tuck cost", "4", "210", "$7.32"],
    ["cosmetic procedures miami", "6", "170", "$10.18"],
    ["brow lift cost miami", "5", "10", "$0.00"],
    ["skin cancer removal surgery cost", "5", "10", "$0.00"],
    ["j-plasma cost in miami", "6", "10", "$1.65"],
    ["breast reduction miami", "4", "—", "—"],
    ["bbl surgery in miami", "4", "—", "—"],
    ["ab sculpting surgery miami", "4", "—", "—"],
  ]),
  ...spacer(1),
  insight("'lymphatic drainage massage miami' ranks position 7 with 1,600 monthly searches — this is a high-volume quick win. Moving from position 7 to position 3 could add hundreds of visits monthly. Lymphatic drainage is commonly sought post-surgery, making this highly relevant to Avana's audience.", "good"),
  insight("'lipo cost miami' and 'liposuction miami cost' both at position 4 with 320 searches each and $7.92 CPC — these are high-commercial-intent cost queries where users are actively comparing prices. A small push to position 1–2 would significantly increase leads.", "warn"),
  ...spacer(1),

  h3("Positions 11–20 — Page 2 Keywords (High Effort, High Reward)"),
  dataTable([
    ["Keyword", "Google Position", "Monthly Volume", "CPC"],
    ["best bbl in miami", "11", "110", "$8.32"],
    ["ab etching miami", "12", "70", "$8.03"],
    ["earlobe repair miami", "20", "70", "$10.24"],
    ["vampire facelift miami", "18", "40", "$5.63"],
    ["lipo 360 cost in miami", "14", "20", "$5.18"],
    ["best bbl surgeon in miami", "11", "—", "—"],
    ["bbl surgeons in miami", "13", "—", "—"],
    ["top 10 bbl surgeons in miami", "13", "—", "—"],
    ["skin cancer removal surgery in miami", "11", "—", "—"],
    ["smartlipo cost in miami", "15", "—", "—"],
  ]),
  ...spacer(1),

  h3("Not Currently Ranking — Gap Opportunities"),
  dataTable([
    ["Keyword", "Monthly Volume", "Priority"],
    ["body contouring procedures", "6,600", "🔴 High — not ranking at all"],
    ["cosmetic surgery for men", "5,400", "🔴 High — not ranking at all"],
    ["blepharoplasty miami", "390", "🟠 Medium — eyelid surgery page needed"],
    ["botox injections miami", "50", "🟡 Low — tracked but not ranking"],
    ["body lift miami", "50", "🟡 Low"],
  ]),
  ...spacer(1),
  insight("'body contouring procedures' (6,600 searches/mo) and 'cosmetic surgery for men' (5,400 searches/mo) are high-volume keywords Avana is not ranking for at all. These represent significant content gap opportunities — dedicated pages for each could capture thousands of monthly visitors.", "bad"),
  kwTable([
    ["Query", "Clicks", "Impressions", "CTR", "Avg Pos"],
    ["avana plastic surgery", "19,800", "44,317", "44.7%", "~1–2"],
    ["avana plastic surgery dallas", "4,285", "11,781", "36.4%", "~1–3"],
    ["avana plastic surgery miami", "1,782", "4,682", "38.1%", "~1–3"],
    ["avana plastic surgery photos", "620", "2,166", "28.6%", "~2–4"],
    ["dr mameniskis", "552", "1,402", "39.4%", "~1–2"],
    ["avana plastic", "432", "1,048", "41.2%", "~1–2"],
    ["avana plastic surgery reviews", "336", "8,706", "3.9%", "~8–12"],
    ["avana", "349", "3,200", "10.9%", "~4–6"],
    ["dr mameniskis miami", "327", "635", "51.5%", "~1"],
    ["body by avana", "288", "584", "49.3%", "~1"],
    ["avana miami", "271", "638", "42.5%", "~1–2"],
    ["avana surgery", "258", "555", "46.5%", "~1–2"],
    ["dr luster miami", "257", "741", "34.7%", "~1–3"],
    ["avana dallas", "233", "746", "31.2%", "~1–3"],
    ["avana plastic surgery portal", "248", "1,812", "13.7%", "~3–5"],
    ["bodybyavana", "243", "589", "41.3%", "~1"],
    ["dr mcdaniel miami", "221", "546", "40.5%", "~1–2"],
    ["mommy makeover miami", "187", "4,933", "3.8%", "~10–15"],
    ["dr stephanie luster", "186", "464", "40.1%", "~1"],
  ]),
  ...spacer(1),
  insight("CRITICAL FINDING: The vast majority of top-click queries are BRANDED (avana plastic surgery, dr mameniskis, body by avana, etc.). Non-branded procedure keywords like 'mommy makeover miami' (4,933 impressions, 187 clicks, ~3.8% CTR) show very low click-through — indicating poor rankings for high-intent commercial keywords.", "bad"),
  insight("Opportunity: 'avana plastic surgery reviews' has 8,706 impressions but only 336 clicks (3.9% CTR) — ranking around position 8–12. This review-intent query is a quick win: improving position + adding Review schema could capture significantly more clicks.", "warn"),
  ...spacer(1),

  h3("Current Keyword Rankings — Fill from Semrush & Authority Labs"),
  kwTable([
    ["Keyword", "Position", "Volume/mo", "KD", "Source"],
    ["[ Fill — Semrush/AL ]", "[ # ]", "[ # ]", "[ % ]", "Semrush"],
    ["[ Fill — Semrush/AL ]", "[ # ]", "[ # ]", "[ % ]", "Semrush"],
    ["[ Fill — Semrush/AL ]", "[ # ]", "[ # ]", "[ % ]", "Semrush"],
    ["[ Fill — Semrush/AL ]", "[ # ]", "[ # ]", "[ % ]", "Semrush"],
    ["[ Fill — Semrush/AL ]", "[ # ]", "[ # ]", "[ % ]", "Semrush"],
    ["[ Fill — GSC ]", "[ # ]", "[ # ]", "—", "GSC"],
    ["[ Fill — GSC ]", "[ # ]", "[ # ]", "—", "GSC"],
  ]),
  ...spacer(1),

  h3("High-Priority Keyword Opportunities (Identified from GSC)"),
  dataTable([
    ["Keyword", "GSC Impressions", "Current CTR", "Opportunity"],
    ["brazilian butt lift miami", "126,985", "0.97%", "Massive — likely ranking p.2+"],
    ["out-of-town patients [surgery]", "57,318", "0.89%", "High — very low CTR"],
    ["medical staff / surgeons", "63,841", "0.77%", "High — informational intent"],
    ["mommy makeover miami", "43,888", "2.68%", "Medium — ranking ~10–15"],
    ["tummy tuck miami", "48,210", "1.08%", "High — ranking p.2+"],
    ["avana plastic surgery reviews", "8,706", "3.86%", "Quick win — near page 1"],
    ["espanol/lipo 360 miami", "49,403", "1.27%", "High — Spanish market"],
  ]),
  ...spacer(1),

  h3("Keyword Gap vs. Competitors"),
  kwTable([
    ["Gap Keyword", "Comp. Position", "Volume/mo", "KD", "Competitor"],
    ["[ Fill — Semrush KW Gap ]", "[ # ]", "[ # ]", "[ % ]", "[ Name ]"],
    ["[ Fill — Semrush KW Gap ]", "[ # ]", "[ # ]", "[ % ]", "[ Name ]"],
    ["[ Fill — Semrush KW Gap ]", "[ # ]", "[ # ]", "[ % ]", "[ Name ]"],
  ]),
  pageBreak(),

  // 2.5 Backlinks
  h2("2.5 Backlink & Domain Authority Analysis"),
  italic("Data source: Semrush Backlink Analytics (avanaplasticsurgery.com — May 2026)"),
  ...spacer(1),
  kpiTable([
    { label: "Authority Score", value: "29 / 100", source: "Semrush" },
    { label: "Referring Domains", value: "533 (-3%)", source: "Semrush" },
    { label: "Total Backlinks", value: "~1,200", source: "Semrush" },
    { label: "Monthly Visits", value: "82,600", source: "Semrush" },
  ]),
  ...spacer(1),
  kpiTable([
    { label: "Organic Traffic (Semrush est.)", value: "23,300", source: "Semrush" },
    { label: "Outbound Domains", value: "23", source: "Semrush" },
    { label: "Unique IPs Linking", value: "252", source: "Semrush" },
    { label: "Toxicity Score", value: "Not configured", source: "Semrush" },
  ]),
  ...spacer(1),
  insight("Authority Score of 29/100 is moderate for a multi-location plastic surgery brand. The profile is tagged 'Reputable' and 'High traffic to backlink ratio' by Semrush — meaning the site punches above its link weight in traffic, which is positive.", "info"),
  insight("CONCERNING: Referring domains have been declining from ~817 to ~521 over the past 12 months — a loss of nearly 300 linking domains. This downward trend in link equity is a significant risk factor for long-term rankings if not reversed.", "bad"),
  insight("Authority Score has remained flat at ~29 for 12 months — no growth. Competitors in the plastic surgery space likely have AS of 35–50+. A structured link building campaign is needed to close this gap.", "warn"),
  ...spacer(1),

  h3("Backlink Profile Composition"),
  dataTable([
    ["Attribute", "Distribution", "Assessment"],
    ["Backlink Type — Text", "~75%", "✅ Healthy — text links carry most SEO value"],
    ["Backlink Type — Image", "~15%", "🟡 Acceptable"],
    ["Backlink Type — Form", "~5%", "🟡 Neutral"],
    ["Link Attribute — Follow", "~85%", "✅ Good — majority pass PageRank"],
    ["Link Attribute — Sponsored", "~10%", "🟡 Monitor — ensure proper tagging"],
    ["Link Attribute — UGC", "~5%", "🟡 Acceptable"],
    ["Top Country — USA", "#1", "✅ Correct for target market"],
    ["Top Countries — Others", "France, England, Mexico, UK", "🟡 Review relevance"],
  ]),
  ...spacer(1),

  h3("Anchor Text Profile"),
  body("Top anchors are predominantly branded (avanaplasticsurgery.com, avana plastic surgery) which is healthy and natural. However this also means the site has very few keyword-rich anchors from external sources — a link building opportunity to build anchors around procedure + location terms (e.g. 'plastic surgery miami', 'brazilian butt lift dallas')."),
  ...spacer(1),

  h3("Top Referring Domains"),
  body("Note: Semrush daily report limit was reached during the audit. The referring domains detail table will be added in the next session. Key metrics already captured: 533 referring domains total, declining trend from ~817 to ~521 over 12 months."),
  dataTable([
    ["Referring Domain", "Authority Score"],
    ["[ Fill next session — Semrush > Referring Domains ]", "[ # ]"],
    ["[ Fill next session ]", "[ # ]"],
    ["[ Fill next session ]", "[ # ]"],
    ["[ Fill next session ]", "[ # ]"],
    ["[ Fill next session ]", "[ # ]"],
  ]),
  ...spacer(1),
  insight("Semrush flagged a Backlink Management opportunity — set up Backlink Audit in Semrush to configure the toxicity score and identify any harmful links that may need disavowing.", "info"),

  h3("Toxic Link Assessment"),
  field("Toxicity Score", "Not yet configured — set up Semrush Backlink Audit", "Semrush"),
  field("Disavow File Currently Active", "[ Confirm in GSC → Links → Disavow ]", "GSC"),
  body("Recommended next step: Run the full Semrush Backlink Audit to identify toxic links. Given the declining referring domains trend, understanding whether lost links were toxic (good) or quality links (bad) is critical."),
  pageBreak(),

  // 2.6 Competitors
  h2("2.6 Competitor Analysis"),
  italic("Data source: Semrush Organic Rankings > Competitors tab (May 14, 2026) — 4,017 total organic competitors identified"),
  ...spacer(1),

  h3("Competitive Positioning Map"),
  body("The Semrush positioning map shows Avana Plastic Surgery (purple) sits at the far right with ~10,000 keywords ranked — the widest keyword footprint among the mapped competitors. However in terms of organic search traffic volume, cgcosmetic.com and spectrum-aesthetics.com generate significantly higher traffic despite fewer keywords, indicating they rank better for higher-volume terms."),
  ...spacer(1),

  h3("Top Organic Competitors"),
  dataTable([
    ["Competitor Domain", "Keyword Overlap", "Common KWs", "SE Keywords", "Est. Traffic", "Traffic Cost"],
    ["thesecretplasticsurgery.com", "38%", "507", "3,700", "3,200", "$5,410"],
    ["iconcosmeticcenter.com", "32%", "386", "3,100", "7,900", "$20,740"],
    ["spectrum-aesthetics.com", "29%", "397", "5,200", "12,000", "$35,750"],
    ["cgcosmetic.com", "26%", "404", "5,700", "32,100", "$76,000"],
    ["pureplasticsurgery.com", "20%", "254", "5,800", "6,700", "$12,660"],
    ["drkmiamiplasticsurgery.com", "20%", "263", "8,400", "6,100", "$10,510"],
    ["prestigeplasticsurgery.com", "17%", "192", "4,100", "[ # ]", "$10,380"],
    ["therealdrmiami.com", "16%", "215", "3,200", "18,100", "$44,530"],
    ["miamiplasticsurgery.com", "14%", "297", "9,100", "20,400", "$46,420"],
    ["4beauty.net", "12%", "132", "3,600", "[ # ]", "$7,730"],
  ]),
  ...spacer(1),
  insight("CRITICAL: cgcosmetic.com generates an estimated 32,100 monthly visits with only 26% keyword overlap — they rank for high-volume procedure keywords Avana does not. Their $76,000/mo traffic cost value vs Avana's $59,300 confirms a significant organic visibility gap.", "bad"),
  insight("miamiplasticsurgery.com and therealdrmiami.com both generate 18,000–20,000 monthly visits with strong local keyword bases. These are the primary Miami-market competitors to close the gap against.", "warn"),
  insight("thesecretplasticsurgery.com has the highest keyword overlap (38%, 507 common keywords) — meaning they directly compete for the same searches. This makes them the most direct competitor and the best source for keyword gap analysis.", "info"),
  ...spacer(1),

  h3("Competitor Strengths to Address"),
  bullet("cgcosmetic.com — Dominates procedure volume keywords (likely BBL, tummy tuck, rhinoplasty) with 32K traffic. Content depth and topical authority appear significantly stronger."),
  bullet("spectrum-aesthetics.com — 12K traffic, $35.7K cost value. Strong non-branded rankings with 5,200 SE keywords despite lower overlap."),
  bullet("miamiplasticsurgery.com — 9,100 SE keywords, 20.4K traffic. Pure local market dominance — likely strong GBP, local citations, and Miami-specific content."),
  bullet("therealdrmiami.com — 18.1K traffic, $44.5K cost value. High authority local competitor — likely strong E-E-A-T and doctor credibility signals."),
  pageBreak(),

  // 2.7 Local SEO
  h2("2.7 Local SEO Analysis"),
  italic("Data source: GSC (location data) + Semrush Listing Management + GBP"),
  ...spacer(1),
  insight("GSC data confirms presence in both Miami and Dallas markets — Dallas Texas page ranks #2 by clicks (8,560) and Miami-specific procedure pages are among the top performers.", "info"),
  ...spacer(1),

  h3("Google Business Profile"),
  field("GBP Claimed & Verified (Miami)", "[ Confirm in GBP ]", "GBP"),
  field("GBP Claimed & Verified (Dallas)", "[ Confirm in GBP ]", "GBP"),
  field("Business Category", "[ e.g. Plastic Surgeon ]", "GBP"),
  field("NAP Consistent (Name, Address, Phone)", "[ GBP vs. website ]", "Manual"),
  field("Total Reviews & Average Rating", "[ Fill from GBP ]", "GBP"),
  field("Recent Review Response Rate", "[ Fill from GBP ]", "GBP"),
  field("Photos Count", "[ Fill from GBP ]", "GBP"),
  field("GBP Posts Active", "[ Yes / No — last post date ]", "GBP"),
  ...spacer(1),

  h3("Local Citations & Directories"),
  field("Total Citations Found", "[ Fill — Semrush Listing Management ]", "Semrush"),
  field("Inconsistent NAP Issues", "[ Fill — Semrush ]", "Semrush"),
  body("Priority directories for plastic surgery:"),
  bullet("RealSelf — critical for plastic surgery"),
  bullet("Healthgrades"),
  bullet("Zocdoc"),
  bullet("WebMD"),
  bullet("Yelp (Miami + Dallas)"),
  bullet("Google Business Profile (confirmed above)"),
  bullet("Vitals.com"),
  bullet("Castle Connolly"),
  ...spacer(1),

  h3("Local Keyword Rankings (GSC Evidence)"),
  dataTable([
    ["Local Keyword", "GSC Clicks", "GSC Impressions", "Opportunity"],
    ["avana plastic surgery miami", "1,782", "4,682", "Strong brand position"],
    ["avana plastic surgery dallas", "4,285", "11,781", "Strong brand position"],
    ["mommy makeover miami", "187", "4,933", "Non-brand — needs improvement"],
    ["tummy tuck miami", "522", "48,210", "Non-brand — low CTR, major opp."],
    ["brazilian butt lift miami", "1,234", "126,985", "Massive non-brand opportunity"],
    ["lipo 360 miami (espanol)", "625", "49,403", "Spanish market — strong opp."],
  ]),
  pageBreak(),

  // 2.8 Findings & Recommendations
  h2("2.8 Findings & Recommendations — Avana Plastic Surgery"),
  body("Priority scale: High = immediate action required | Medium = address within 30 days | Low = address within 90 days"),
  ...spacer(1),

  findingsTable([
    ["Area", "Finding / Issue", "Priority", "Recommendation"],
    ["Technical", "212 pages returning 404 errors", "High", "Audit all 404s; redirect relevant pages (301) to closest live equivalent. Eliminate or restore the rest."],
    ["Technical", "314 pages crawled but not indexed by Google", "High", "Review each page for thin content, duplication, or low value. Consolidate, improve, or noindex."],
    ["Technical", "19 redirect pages failed Google validation", "High", "Fix redirect chains/loops. Ensure all redirects resolve in 1 hop to a live 200 page."],
    ["Technical", "1 server error (5xx) detected", "High", "Identify the affected URL and resolve the server-side error immediately."],
    ["Technical", "Mobile CLS issues on 70 URLs", "Medium", "Add explicit dimensions to all images/iframes. Reserve space for dynamic content. Retest in GSC."],
    ["Technical", "97 pages: Google chose different canonical", "Medium", "Review these pages — likely duplicates. Consolidate content or correct canonical tags."],
    ["Schema", "Video schema: uploadDate missing timezone (83 items)", "Medium", "Update all uploadDate values to include timezone (ISO 8601 format with offset)."],
    ["Schema", "Missing: MedicalBusiness, LocalBusiness, BreadcrumbList, MedicalProcedure schema", "Medium", "Implement across homepage, procedure pages, and location pages to improve rich result eligibility."],
    ["Keywords", "Traffic is ~90% brand-driven; non-brand CTR extremely low", "High", "Build out non-branded procedure + location keyword strategy. Optimize page titles and content for BBL, tummy tuck, mommy makeover."],
    ["Keywords", "BBL Miami page: 126,985 impressions, only 1,234 clicks (0.97% CTR)", "High", "Rewrite title tag and meta description. Improve page rank through on-page optimization + internal links."],
    ["Keywords", "Tummy Tuck Miami: 48,210 impressions, 522 clicks (1.08% CTR)", "High", "Same approach — title/meta rewrite + content expansion + schema."],
    ["Keywords", "Spanish market page /espanol/lipo-360-en-miami: 49,403 impressions, 625 clicks", "Medium", "Expand Spanish-language content. Add hreflang tags. Build Spanish keyword strategy."],
    ["Content", "Thin content likely driving 314 not-indexed pages", "High", "Audit each crawled-not-indexed page. Expand content to 600+ words where viable or consolidate."],
    ["E-E-A-T", "Review doctor credentials visibility (YMYL site)", "High", "Ensure each doctor page shows board certifications, training, before/after work. Critical for Google's quality rating."],
    ["Local SEO", "Multi-location presence (Miami + Dallas) needs full GBP optimization", "High", "Verify GBP for both locations. Add posts, photos, Q&A. Ensure NAP consistency across all citations."],
    ["Local SEO", "RealSelf presence critical for plastic surgery — verify active profile", "High", "Claim/optimize RealSelf profiles for each surgeon. Actively collect reviews."],
  ]),
  pageBreak(),

  // ══════════════════════════════════════════════════════════
  // 3. AVANA WELLNESS PLUS
  // ══════════════════════════════════════════════════════════
  sectionDivider("SECTION 3 — AVANA WELLNESS PLUS"),
  ...spacer(1),
  h1("3. Avana Wellness Plus — Full SEO Audit"),
  field("Website URL", "https://avanawellnessplus.com", "GSC"),
  field("Audit Period", "Feb 14 – May 14, 2026 (3 months)", "GSC"),
  field("Data Last Updated", "~4 hours before export", "GSC"),
  pageBreak(),

  h2("3.1 Site Overview & Key Performance Indicators"),
  italic("Data source: Google Search Console — Performance (3 months export) + Google Analytics"),
  ...spacer(1),

  h3("GSC Performance KPIs"),
  kpiTable([
    { label: "Total Clicks", value: "558", source: "GSC" },
    { label: "Total Impressions", value: "72,000", source: "GSC" },
    { label: "Average CTR", value: "0.8%", source: "GSC" },
    { label: "Average Position", value: "17.7", source: "GSC" },
  ]),
  ...spacer(1),
  kpiTable([
    { label: "Organic Sessions", value: "772", source: "GA4" },
    { label: "Engaged Sessions", value: "397", source: "GA4" },
    { label: "Engagement Rate", value: "51.42%", source: "GA4" },
    { label: "Avg. Engagement Time", value: "54s", source: "GA4" },
  ]),
  ...spacer(1),
  kpiTable([
    { label: "Total Site Sessions", value: "1,230", source: "GA4" },
    { label: "Organic Share of Sessions", value: "62.8%", source: "GA4" },
    { label: "Key Events (Organic)", value: "0 — NOT configured", source: "GA4" },
    { label: "Session Key Event Rate", value: "0%", source: "GA4" },
  ]),
  ...spacer(1),

  h3("Channel Breakdown — All Traffic Sources"),
  dataTable([
    ["Channel", "Sessions", "Engaged Sessions", "Engagement Rate", "Avg. Time", "Key Events"],
    ["Organic Search", "772", "397", "51.42%", "54s", "0"],
    ["Direct", "394", "148", "37.56%", "35s", "0"],
    ["Unassigned", "46", "28", "60.87%", "1m 47s", "0"],
    ["Referral", "15", "7", "46.67%", "59s", "0"],
    ["Organic Social", "3", "3", "100%", "47s", "0"],
    ["TOTAL", "1,230", "583", "~47.4%", "~54s", "0"],
  ]),
  ...spacer(1),
  insight("CRITICAL: Zero Key Events recorded across ALL channels. No conversion tracking is configured in GA4 for Wellness Plus. The team has zero visibility into how many leads the site generates. This must be fixed before any SEO results can be measured.", "bad"),
  insight("Organic Search dominates with 772 sessions (62.8% of all traffic) — SEO is already the #1 acquisition channel for this site even at small scale.", "good"),
  insight("COMPARISON: Avana Plastic Surgery generated 115,997 organic sessions vs Wellness Plus's 772 in the same period — a 150x difference. This is the single biggest growth opportunity in the portfolio.", "bad"),
  dataTable([
    ["Device", "Clicks", "Impressions", "CTR", "Avg. Position"],
    ["Mobile", "440", "37,997", "1.16%", "10.83"],
    ["Desktop", "114", "33,503", "0.34%", "25.67"],
    ["Tablet", "4", "518", "0.77%", "11.39"],
  ]),
  ...spacer(1),
  insight("Mobile dominates clicks (440 of 558 — 79%) but Desktop has a dramatically worse CTR (0.34%) and average position (25.67) vs Mobile (1.16%, pos 10.83). Desktop visibility is critically poor — the site barely appears on page 2 for desktop searches.", "bad"),
  ...spacer(1),

  h3("Performance by Country"),
  dataTable([
    ["Country", "Clicks", "Impressions", "CTR", "Avg. Position"],
    ["United States", "531", "64,427", "0.82%", "18.13"],
    ["United Kingdom", "2", "340", "0.59%", "18.65"],
    ["Colombia", "2", "311", "0.64%", "14.37"],
    ["Argentina", "2", "304", "0.66%", "11.15"],
    ["Mexico", "1", "716", "0.14%", "14.03"],
    ["Peru", "2", "111", "1.80%", "9.65"],
    ["Dominican Republic", "2", "102", "1.96%", "8.17"],
  ]),
  ...spacer(1),
  insight("95% of clicks come from the United States (531/558) — correct for a Miami-based clinic. The presence of Spanish-speaking countries (Colombia, Argentina, Mexico, Peru, Dominican Republic) in the data confirms the site's Spanish-language pages are reaching the right international audience.", "info"),
  ...spacer(1),

  h3("Traffic Trend Analysis"),
  body("Over the 3-month period, daily clicks fluctuated between 0 and 15 — extremely low volume compared to Avana Plastic Surgery's 400–1,200 daily clicks. Impressions range between 500–1,500 per day. The trend shows no significant growth — the site is essentially flat with very limited organic visibility. This confirms Avana Wellness Plus requires a full SEO build-out from near ground level."),
  insight("CRITICAL COMPARISON: Avana Plastic Surgery generates 62,500 clicks from 1.62M impressions. Avana Wellness Plus generates only 558 clicks from 72,000 impressions — roughly 112x less traffic. This is the single biggest opportunity in the entire Sevenlogik portfolio.", "bad"),
  ...spacer(1),

  h3("Top Queries by Clicks — GSC (3 months)"),
  kwTable([
    ["Query", "Clicks", "Impressions", "CTR", "Avg Pos"],
    ["avana wellness plus", "34", "109", "31.19%", "2.73"],
    ["avana wellness", "23", "58", "39.66%", "1.93"],
    ["avana wellness center", "7", "65", "10.77%", "11.32"],
    ["keloid removal cost", "4", "350", "1.14%", "10.34"],
    ["1645 sw 107th ave (address)", "3", "257", "1.17%", "5.10"],
    ["dr golio avana", "3", "81", "3.70%", "2.68"],
    ["dr dominick golio", "3", "62", "4.84%", "5.58"],
    ["dr golio miami", "2", "199", "1.01%", "6.78"],
    ["how much is keloid removal surgery", "2", "104", "1.92%", "9.09"],
    ["lip filler miami", "1", "267", "0.37%", "51.97"],
    ["botox miami price", "1", "212", "0.47%", "9.85"],
    ["keloid removal near me", "1", "196", "0.51%", "10.54"],
    ["lip augmentation miami", "1", "—", "—", "41.87"],
    ["iv therapy miami", "1", "4,916", "0.14%", "32.71"],
    ["keloid removal miami", "1", "157", "0.64%", "13.46"],
  ]),
  ...spacer(1),
  insight("Almost ALL top queries are branded (avana wellness, avana wellness plus, dr golio). The site has virtually zero non-branded organic visibility. Every service keyword — botox miami, lip filler miami, iv therapy miami, keloid removal miami — shows either 0–1 clicks or extremely poor positions (32–51).", "bad"),
  insight("'lip filler miami' ranks at position 51.97 — page 5+. 'iv therapy miami' ranks at position 32.71 with 4,916 impressions but only 1 click (0.14% CTR). 'lip augmentation miami' ranks at position 41.87 with 4,470 impressions and 4 clicks. These are high-potential keywords the site is nearly invisible for.", "bad"),
  insight("Keloid removal is the strongest non-branded opportunity — 'keloid removal cost' (pos 10.34), 'how much is keloid removal surgery' (pos 9.09), 'keloid removal near me' (pos 10.54). All hovering just outside page 1. A focused push could bring these to page 1 quickly.", "warn"),
  ...spacer(1),

  h3("Top Landing Pages by Clicks — GSC (3 months)"),
  dataTable([
    ["Page URL", "Clicks", "Impressions", "CTR", "Avg Pos"],
    ["avanawellnessplus.com/ (Homepage)", "119", "3,989", "2.98%", "7.33"],
    ["/espanol/eliminacion-verruga-en-miami", "54", "4,290", "1.26%", "6.70"],
    ["/espanol/aumento-labios-en-miami", "47", "7,408", "0.63%", "8.55"],
    ["/espanol/examenes-medicos-de-inmigracion-miami", "35", "3,967", "0.88%", "13.94"],
    ["/espanol/terapia-intravenosa-miami", "34", "2,722", "1.25%", "9.69"],
    ["/dr-dominick-golio", "31", "2,804", "1.11%", "7.01"],
    ["/immigration-medical-exam-miami", "29", "3,064", "0.95%", "18.85"],
    ["/keloid-removal-miami", "25", "7,793", "0.32%", "13.05"],
    ["/espanol/rellenos-para-ojeras-en-miami", "21", "1,115", "1.88%", "8.94"],
    ["/wart-removal-miami", "10", "4,353", "0.23%", "17.18"],
    ["/botox-miami", "9", "2,793", "0.32%", "26.83"],
    ["/iv-therapy-miami", "7", "4,916", "0.14%", "32.71"],
    ["/lip-augmentation-miami", "4", "4,470", "0.09%", "41.87"],
  ]),
  ...spacer(1),
  insight("MAJOR FINDING: Spanish-language pages are outperforming their English equivalents. The Spanish wart removal page (54 clicks) outperforms English wart removal (10 clicks). Spanish lip augmentation (47 clicks) vs English lip augmentation (4 clicks). The Spanish-speaking Miami market is clearly more engaged with this site than English speakers.", "good"),
  insight("Keloid removal page has 7,793 impressions — the highest of any page — but only 25 clicks (0.32% CTR) at position 13. This is the #1 quick-win page for Wellness Plus. Moving from position 13 to position 3 could increase clicks by 10x.", "warn"),
  insight("IV therapy miami page: 4,916 impressions, 7 clicks, 0.14% CTR, position 32. This is a high-value wellness service the site is essentially invisible for. A complete page rewrite and optimization is needed.", "bad"),

  h3("Conversion & Goal Performance"),
  field("Primary Conversion Event", "NOT CONFIGURED — zero key events in GA4", "GA4"),
  field("Total Key Events (Organic)", "0", "GA4"),
  field("Session Key Event Rate", "0%", "GA4"),
  field("Top Converting Pages", "Cannot determine — no key events configured", "GA4"),
  insight("URGENT: Set up GA4 Key Events for Wellness Plus immediately. Recommended events to configure: contact_form_submitted, phone_call_click, appointment_request, direction_click. Without these, all future SEO reporting will be blind to actual lead generation.", "bad"),
  pageBreak(),

  h2("3.2 Technical SEO Audit"),
  italic("Data source: GSC Coverage export (May 15, 2026) + GSC Core Web Vitals + Semrush Site Audit"),
  ...spacer(1),

  h3("Crawlability & Indexation"),
  kpiTable([
    { label: "Pages Indexed", value: "~50–51", source: "GSC" },
    { label: "Pages NOT Indexed", value: "10–11", source: "GSC" },
    { label: "Total Site Size", value: "~61 pages", source: "GSC" },
    { label: "Semrush Site Health", value: "Not available — plan limit", source: "Semrush" },
  ]),
  ...spacer(1),
  insight("CRITICAL: Avana Wellness Plus has only ~61 total pages — an extremely small site for a medical wellness clinic. Avana Plastic Surgery has 1,751 pages (1,010 indexed + 741 not indexed). The content volume gap between the two sites is enormous and directly explains the traffic gap.", "bad"),
  ...spacer(1),

  dataTable([
    ["Reason Not Indexed", "Pages", "Source", "Severity"],
    ["Not found (404)", "8", "Website", "🔴 Critical"],
    ["Crawled — currently not indexed", "2", "Google Systems", "🟠 High"],
    ["Discovered — currently not indexed", "1", "Google Systems", "🟠 High"],
  ]),
  ...spacer(1),
  insight("8 pages returning 404 errors on a 61-page site is proportionally very damaging — that's 13% of the total site broken. On Plastic Surgery, 212 of 1,751 pages were 404s (12%). The ratio is similar but on a much smaller site every page counts more.", "bad"),
  insight("Indexed page count has been essentially flat at 49–51 pages throughout the entire 3-month period — no content growth detected. New pages need to be created urgently to expand the site's topical footprint.", "warn"),
  ...spacer(1),

  field("Sitemap Status", "Submitted — all known pages", "GSC"),
  field("Robots.txt", "[ Confirm accessible at avanawellnessplus.com/robots.txt ]", "Manual"),
  field("Semrush Errors / Warnings", "Not available — Semrush plan limit reached. Upgrade to Starter plan or free up a project slot to run full audit.", "Semrush"),
  insight("ACTION REQUIRED: Semrush's current plan has reached its website monitoring limit. To run a Site Audit for Wellness Plus, either upgrade to the Starter plan or remove an existing project. Recommended before Monday's meeting if possible.", "warn"),
  ...spacer(1),

  h3("Core Web Vitals"),
  italic("Data source: GSC Core Web Vitals (last updated May 13, 2026)"),
  ...spacer(1),
  dataTable([
    ["Device", "Status", "Notes"],
    ["Mobile", "⚠️ No Data Available", "Not enough Chrome UX Report data — site traffic too low"],
    ["Desktop", "⚠️ No Data Available", "Not enough Chrome UX Report data — site traffic too low"],
  ]),
  ...spacer(1),
  insight("CWV data is unavailable for both Mobile and Desktop because the site does not receive enough traffic for Google's Chrome UX Report to generate reliable field data. This is itself a warning sign — the site needs PageSpeed Insights run manually on key pages to assess performance. GSC recommends using PageSpeed Insights as an alternative.", "warn"),
  body("Recommended action: Run PageSpeed Insights (pagespeed.web.dev) on the following key pages and record LCP, CLS, and INP scores: homepage, keloid removal miami, IV therapy miami, lip augmentation miami, and the top Spanish-language pages."),
  ...spacer(1),

  h3("HTTPS & Security"),
  field("SSL / HTTPS Status", "[ Confirm — site loads on HTTPS ]", "Manual"),
  field("Mixed Content Issues", "[ Fill — Semrush Site Audit ]", "Semrush"),
  ...spacer(1),

  h3("Mobile Friendliness"),
  body("GSC does not show mobile usability errors for this property — however given the site's low traffic, issues may exist but not be detected at scale. Manual testing on mobile devices recommended for all key pages."),
  ...spacer(1),

  h3("Structured Data / Schema Markup"),
  field("Schema Types Present", "[ Fill — GSC Enhancements section ]", "GSC"),
  field("Rich Result Errors", "[ Fill — GSC Enhancements ]", "GSC"),
  body("Given the site's small scale and low traffic, schema markup is likely minimal or absent. Priority schema to implement: LocalBusiness, MedicalBusiness, FAQPage, Person (for Dr. Golio and Dr. Bentancor), and Service pages."),
  ...spacer(1),

  h3("Internal Linking & Duplicate Content"),
  field("Pages with Only 1 Internal Link", "[ Fill — Semrush ]", "Semrush"),
  field("Broken Internal Links", "[ Fill — Semrush ]", "Semrush"),
  field("Duplicate Content Issues", "[ Fill — Semrush ]", "Semrush"),
  body("With only ~61 pages, internal linking opportunities are limited but critical. Every page should link to related service pages and the contact page. Spanish pages should cross-link to their English equivalents with proper hreflang tags."),
  pageBreak(),

  h2("3.3 On-Page & Content Analysis"),
  italic("Data source: GSC page data + manual review. Note: Semrush on-page audit pending plan renewal."),
  ...spacer(1),

  h3("Title Tags & Meta Descriptions"),
  dataTable([
    ["Issue", "Count", "Priority"],
    ["Missing Title Tags", "[ Confirm — Semrush pending ]", "🔴 Critical"],
    ["Duplicate Title Tags", "[ Confirm — Semrush pending ]", "🔴 Critical"],
    ["Title Tags Too Long (>60 chars)", "[ Confirm — Semrush pending ]", "🟠 High"],
    ["Missing Meta Descriptions", "[ Confirm — Semrush pending ]", "🟠 High"],
    ["Duplicate Meta Descriptions", "[ Confirm — Semrush pending ]", "🟠 High"],
    ["Pages Missing H1", "[ Confirm — Semrush pending ]", "🟠 High"],
  ]),
  ...spacer(1),
  insight("From GSC evidence: pages with very low CTR (IV therapy miami 0.14%, lip augmentation miami 0.09%, wart removal miami 0.23%) almost certainly have weak or generic title tags not aligned with search intent. These should be manually reviewed and rewritten immediately without waiting for Semrush.", "warn"),
  ...spacer(1),

  h3("Content Quality Assessment — Key Pages"),
  body("Based on GSC page performance data, here are the most important pages and their content needs:"),
  dataTable([
    ["Page", "Impressions", "CTR", "Content Priority"],
    ["/keloid-removal-miami", "7,793", "0.32%", "🔴 Full rewrite — highest impression page"],
    ["/espanol/aumento-labios-en-miami", "7,408", "0.63%", "🔴 Expand — strong Spanish demand"],
    ["/iv-therapy-miami", "4,916", "0.14%", "🔴 Complete rewrite — nearly invisible"],
    ["/wart-removal-miami", "4,353", "0.23%", "🔴 Expand — very low CTR"],
    ["/lip-augmentation-miami", "4,470", "0.09%", "🔴 Rewrite — lowest CTR on site"],
    ["/immigration-medical-exam-miami", "3,064", "0.95%", "🟠 Optimize — good intent signal"],
    ["/espanol/eliminacion-verruga-en-miami", "4,290", "1.26%", "🟠 Improve — top Spanish performer"],
    ["/botox-miami", "2,793", "0.32%", "🔴 Rewrite — high value, near invisible"],
  ]),
  ...spacer(1),
  insight("The site has a critical content problem — most pages have very high impressions but extremely low CTR, indicating Google is finding the pages but users are not clicking. This points to weak title tags, poor meta descriptions, and likely thin content that doesn't match search intent.", "bad"),
  insight("Spanish-language pages consistently outperform their English equivalents in CTR. The /espanol/eliminacion-verruga-en-miami page (1.26% CTR) outperforms /wart-removal-miami (0.23%) despite similar impressions. Priority should be given to expanding the Spanish content section.", "good"),
  ...spacer(1),

  h3("Content Gap — Missing Service Pages"),
  body("Based on GSC query data, users are searching for services Wellness Plus likely offers but may not have dedicated pages for:"),
  bullet("Botox miami cost / botox miami price — high intent cost queries with no dedicated pricing page"),
  bullet("Under eye filler cost — 76 impressions, ranking position 40"),
  bullet("Lipoma removal miami — 62 impressions, only 1 click"),
  bullet("Immigration doctor near me — local intent, 31 impressions"),
  bullet("IV vitamin therapy — multiple Spanish queries showing demand"),
  bullet("Dermatologist services — wart, keratosis, sebaceous cyst removal all have separate demand"),
  ...spacer(1),

  h3("E-E-A-T Signals — Critical for Medical / Wellness Site"),
  bullet("Dr. Dominick Golio page exists (/dr-dominick-golio — 31 clicks, 2,804 impressions) — confirm credentials, board certifications, and specialties are clearly listed"),
  bullet("Dr. Silvia Bentancor page exists (/dr-silvia-bentancor — 10 clicks, 724 impressions) — same review needed"),
  bullet("Medical disclaimers on all procedure pages: [ Confirm ]"),
  bullet("Patient testimonials / reviews integrated: [ Confirm ]"),
  bullet("Immigration medical exam pages should clearly show USCIS authorization and civil surgeon designation — critical for this service"),
  pageBreak(),

  h2("3.4 Keyword & Ranking Analysis"),
  italic("Data source: GSC Queries export (May 15, 2026). Note: Semrush & Authority Labs data pending — not yet configured for this domain."),
  ...spacer(1),

  h3("Keyword Overview"),
  kpiTable([
    { label: "Total GSC Queries", value: "~200+", source: "GSC" },
    { label: "Queries with Clicks", value: "~50", source: "GSC" },
    { label: "Branded Queries", value: "~95%", source: "GSC" },
    { label: "Non-Branded Queries", value: "~5%", source: "GSC" },
  ]),
  ...spacer(1),
  insight("The site ranks for very few non-branded keywords. Almost all clicks come from people already searching for 'avana wellness' or 'dr golio' by name. Building non-branded keyword rankings is the core SEO challenge for this site.", "bad"),
  ...spacer(1),

  h3("Top Queries by Clicks — GSC (3 months)"),
  kwTable([
    ["Query", "Clicks", "Impressions", "CTR", "Avg Pos"],
    ["avana wellness plus", "34", "109", "31.19%", "2.73"],
    ["avana wellness", "23", "58", "39.66%", "1.93"],
    ["avana wellness center", "7", "65", "10.77%", "11.32"],
    ["keloid removal cost", "4", "350", "1.14%", "10.34"],
    ["1645 sw 107th ave (address)", "3", "257", "1.17%", "5.10"],
    ["dr golio avana", "3", "81", "3.70%", "2.68"],
    ["dr dominick golio", "3", "62", "4.84%", "5.58"],
    ["dr golio miami", "2", "199", "1.01%", "6.78"],
    ["how much is keloid removal surgery", "2", "104", "1.92%", "9.09"],
    ["botox miami price", "1", "212", "0.47%", "9.85"],
    ["keloid removal near me", "1", "196", "0.51%", "10.54"],
    ["lip filler miami", "1", "267", "0.37%", "51.97"],
    ["iv therapy miami", "1", "4,916", "0.14%", "32.71"],
    ["lip augmentation miami", "1", "4,470", "0.09%", "41.87"],
    ["keloid removal miami", "1", "157", "0.64%", "13.46"],
  ]),
  ...spacer(1),

  h3("Quick Win Keywords — Near Page 1"),
  dataTable([
    ["Keyword", "GSC Position", "Impressions", "Current CTR", "Action Needed"],
    ["keloid removal cost", "10.34", "350", "1.14%", "Optimize page — just off page 1"],
    ["how much is keloid removal surgery", "9.09", "104", "1.92%", "Add pricing content + FAQ schema"],
    ["keloid removal near me", "10.54", "196", "0.51%", "Strengthen local SEO signals"],
    ["dr golio miami", "6.78", "199", "1.01%", "Improve doctor page content"],
    ["botox miami price", "9.85", "212", "0.47%", "Add pricing section to botox page"],
    ["botox miami cost", "10.80", "59", "1.69%", "Same as above — merge intent"],
  ]),
  ...spacer(1),
  insight("Keloid removal is the clearest non-branded opportunity — 3 related queries all hovering around position 9–11. A single focused optimization effort on the keloid removal page (expanded content, FAQ schema, local signals) could push all three to page 1 simultaneously.", "good"),
  ...spacer(1),

  h3("High-Volume Keywords Currently Invisible"),
  dataTable([
    ["Keyword", "Impressions", "CTR", "Position", "Gap"],
    ["iv therapy miami", "4,916", "0.14%", "32.71", "Page 3+ — needs full page rewrite"],
    ["lip augmentation miami", "4,470", "0.09%", "41.87", "Page 4+ — nearly invisible"],
    ["lip filler miami", "267", "0.37%", "51.97", "Page 5+ — not competitive"],
    ["wart removal miami (English)", "4,353", "0.23%", "17.18", "Page 2 — needs optimization"],
    ["botox miami", "2,793", "0.32%", "26.83", "Page 3 — needs major work"],
  ]),
  ...spacer(1),
  insight("IV therapy miami (4,916 impressions, position 32) and lip augmentation miami (4,470 impressions, position 41) are high-volume service keywords the site is nearly invisible for. These represent the biggest long-term traffic opportunities if properly developed with dedicated, comprehensive pages.", "bad"),

  h3("Keyword Tracking — Setup Required"),
  body("Authority Labs has not been configured for avanawellnessplus.com. Recommended keywords to add for tracking immediately:"),
  bullet("keloid removal miami / keloid removal cost"),
  bullet("botox miami / botox miami cost / botox miami price"),
  bullet("lip filler miami / lip augmentation miami"),
  bullet("iv therapy miami / iv vitamin therapy miami"),
  bullet("immigration medical exam miami / civil surgeon miami"),
  bullet("wart removal miami / wart removal near me"),
  bullet("avana wellness plus / avana wellness / dr golio miami"),
  pageBreak(),

  h2("3.5 Backlink & Domain Authority Analysis"),
  italic("Data source: Semrush Backlink Analytics — PENDING. Semrush subscription renewal required."),
  ...spacer(1),
  kpiTable([
    { label: "Domain Authority (AS)", value: "Pending — Semrush renewal", source: "Semrush" },
    { label: "Total Backlinks", value: "Pending — Semrush renewal", source: "Semrush" },
    { label: "Referring Domains", value: "Pending — Semrush renewal", source: "Semrush" },
    { label: "Toxic Links", value: "Pending — Semrush renewal", source: "Semrush" },
  ]),
  ...spacer(1),
  insight("Backlink data for Avana Wellness Plus will be added after Semrush subscription is renewed. Given the site's very low traffic (772 organic sessions) and minimal indexed pages (~61), the domain authority is expected to be significantly lower than Avana Plastic Surgery (AS: 29). Link building will be a key long-term priority.", "info"),
  body("Priority actions once Semrush is available: run Backlink Analytics, identify referring domains, check for toxic links, and compare authority against key wellness/dermatology competitors in Miami."),
  pageBreak(),

  h2("3.6 Competitor Analysis"),
  italic("Data source: Semrush Organic Rankings — PENDING. Inferred analysis based on GSC query data and known market."),
  ...spacer(1),
  insight("Full competitor data via Semrush is pending subscription renewal. The following analysis is based on known market context and GSC evidence.", "info"),
  ...spacer(1),

  h3("Likely Key Competitors — Miami Wellness & Dermatology Market"),
  dataTable([
    ["Competitor Type", "Domain (estimated)", "Why They Compete"],
    ["Medical spas / aesthetics", "Various Miami medspa sites", "Botox, lip filler, facial treatments"],
    ["Dermatology clinics", "Miami dermatology practices", "Keloid, wart, keratosis, lipoma removal"],
    ["IV therapy clinics", "Miami IV therapy centers", "IV vitamin therapy, wellness drips"],
    ["Immigration doctors", "Civil surgeon practices in Miami", "USCIS medical exams"],
    ["Plastic surgery crossover", "avanaplasticsurgery.com", "Shared brand, some service overlap"],
  ]),
  ...spacer(1),
  body("From GSC data, the site is losing to competitors on virtually every non-branded keyword. Pages ranking 17–51 for high-intent terms like 'iv therapy miami', 'lip augmentation miami', and 'botox miami' indicate strong competition from dedicated medspa and dermatology sites with more content depth and authority."),
  insight("OPPORTUNITY: The immigration medical exam service appears to be a relatively low-competition niche — 'examen médico para inmigración cerca de mi' ranks at position 15 and 'uscis medical exam near me' at position 11. This is a unique service with strong local demand and less competition than cosmetic services.", "good"),
  pageBreak(),

  h2("3.7 Local SEO Analysis"),
  italic("Data source: GSC geographic data + manual review recommendations"),
  ...spacer(1),

  h3("Local Presence Evidence from GSC"),
  body("GSC confirms the site is primarily serving the Miami, FL market (531 of 558 clicks from the United States). The address query '1645 sw 107th ave' appeared 3 times with 257 impressions — users are actively looking up the physical location, confirming local search intent."),
  ...spacer(1),

  h3("Google Business Profile"),
  field("GBP Claimed & Verified", "[ Confirm at business.google.com ]", "GBP"),
  field("Business Category", "[ e.g. Medical Spa / Wellness Center / Dermatologist ]", "GBP"),
  field("NAP — Name, Address, Phone", "[ Confirm: 1645 SW 107th Ave, Miami FL 33174 on site vs GBP ]", "Manual"),
  field("Total Reviews & Average Rating", "[ Fill from GBP ]", "GBP"),
  field("GBP Posts Active", "[ Yes / No — last post date ]", "GBP"),
  field("Photos Count", "[ Fill from GBP ]", "GBP"),
  ...spacer(1),

  h3("Local Citations"),
  field("Total Citations", "[ Pending — Semrush Listing Management ]", "Semrush"),
  field("NAP Inconsistencies", "[ Pending — Semrush ]", "Semrush"),
  body("Priority directories for a medical wellness clinic:"),
  bullet("Healthgrades — critical for medical credibility"),
  bullet("Zocdoc — appointment booking for medical services"),
  bullet("Yelp Miami — local discovery for medspa services"),
  bullet("RealSelf — relevant for aesthetic treatments"),
  bullet("WebMD physician directory — for Dr. Golio and Dr. Bentancor"),
  bullet("USCIS Civil Surgeon directory — for immigration medical exam service"),
  bullet("Google Business Profile — primary local ranking signal"),
  ...spacer(1),

  h3("Local Keyword Performance — GSC"),
  dataTable([
    ["Local Keyword", "Clicks", "Impressions", "Position", "Opportunity"],
    ["keloid removal near me", "1", "196", "10.54", "🟠 Near page 1 — local intent"],
    ["immigration doctor near me", "1", "31", "9.06", "🟠 Near page 1 — local intent"],
    ["examen médico inmigración cerca de mi", "2", "146", "15.09", "🟠 Spanish local intent"],
    ["dr golio miami", "2", "199", "6.78", "🟢 Good — doctor local search"],
    ["keloid removal miami", "1", "157", "13.46", "🟠 Page 2 — needs push"],
    ["botox miami price", "1", "212", "9.85", "🟠 Near page 1 — high value"],
  ]),
  pageBreak(),

  h2("3.8 Findings & Recommendations — Avana Wellness Plus"),
  body("Priority scale: High = immediate action required | Medium = address within 30 days | Low = address within 90 days"),
  ...spacer(1),
  findingsTable([
    ["Area", "Finding / Issue", "Priority", "Recommendation"],
    ["Analytics", "Zero Key Events / conversions configured in GA4", "High", "Set up GA4 Key Events immediately: contact_form_submitted, phone_call_click, appointment_request. Cannot measure SEO success without this."],
    ["Technical", "8 of 61 pages (13%) returning 404 errors", "High", "Audit all 404 pages. Redirect to relevant live pages or restore content. Every page matters on a 61-page site."],
    ["Technical", "Semrush Site Audit not available — plan renewal needed", "High", "Renew Semrush subscription and run full site audit for avanawellnessplus.com as first priority after payment."],
    ["Technical", "CWV data unavailable — traffic too low for Chrome UX data", "Medium", "Run PageSpeed Insights manually on top 5 pages. Fix any LCP or CLS issues found."],
    ["Content", "Only ~61 pages — site is critically underdeveloped", "High", "Content expansion is the #1 long-term priority. Target: 150+ pages covering all services, FAQs, blog, Spanish versions, and location pages."],
    ["Content", "IV therapy miami: 4,916 impressions, 0.14% CTR, position 32", "High", "Complete page rewrite — expand content to 1,000+ words, add pricing, benefits, FAQ schema, and strong title tag."],
    ["Content", "Lip augmentation miami: 4,470 impressions, 0.09% CTR, position 41", "High", "Full page rewrite — nearly invisible for highest-value aesthetic keyword."],
    ["Content", "Botox miami: 2,793 impressions, 0.32% CTR, position 26", "High", "Rewrite page with comprehensive content — pricing, before/after, FAQ, doctor credentials."],
    ["Keywords", "95%+ of traffic is branded — zero non-branded visibility", "High", "Build non-branded keyword strategy starting with keloid removal, botox, IV therapy, lip filler, immigration exam."],
    ["Keywords", "Keloid removal queries hovering at position 9–11 (3 related queries)", "Medium", "Focus optimization effort on keloid removal page — quickest path to page 1 rankings."],
    ["Local SEO", "Immigration medical exam — near page 1 for local queries", "Medium", "Strengthen local signals: GBP posts, USCIS directory listing, patient reviews, location-specific content."],
    ["Local SEO", "GBP status unconfirmed", "High", "Verify GBP is claimed, verified, and fully optimized for all services. Add photos, posts, Q&A."],
    ["E-E-A-T", "Doctor profile pages exist but need credential strengthening", "High", "Add board certifications, education, years of experience, and specialties to Dr. Golio and Dr. Bentancor pages."],
    ["Schema", "No structured data detected in GSC Enhancements", "Medium", "Implement: LocalBusiness, MedicalBusiness, Person (doctors), FAQPage, Service schema across all key pages."],
    ["Tracking", "Authority Labs not configured for Wellness Plus", "Medium", "Add avanawellnessplus.com to Authority Labs. Track top 20 target keywords from day one to measure progress."],
    ["Spanish", "Spanish pages outperform English equivalents consistently", "Medium", "Expand Spanish content section. Add hreflang tags. Consider Spanish-first strategy for key services."],
  ]),
  pageBreak(),

  // ══════════════════════════════════════════════════════════
  // 4. CROSS-SITE COMPARISON
  // ══════════════════════════════════════════════════════════
  sectionDivider("SECTION 4 — CROSS-SITE COMPARISON"),
  ...spacer(1),
  h1("4. Cross-Site Comparison & Shared Opportunities"),
  ...spacer(1),

  dataTable([
    ["Metric", "Avana Plastic Surgery", "Avana Wellness Plus"],
    ["Total Clicks / 3mo (GSC)", "62,500", "558"],
    ["Total Impressions / 3mo", "1,620,000", "72,000"],
    ["Avg. CTR", "3.9%", "0.8%"],
    ["Avg. Position", "14.4", "17.7"],
    ["Organic Sessions / 3mo (GA4)", "115,997", "772"],
    ["Pages Indexed", "1,010", "~51"],
    ["Total Site Pages", "~1,751", "~61"],
    ["404 Errors", "212 (12%)", "8 (13%)"],
    ["Domain Authority (Semrush AS)", "29", "[ Fill ]"],
    ["Semrush Site Health", "90%", "Not audited (plan limit)"],
    ["CWV Desktop", "✅ Pass (750 good URLs)", "⚠️ No data (low traffic)"],
    ["CWV Mobile", "⚠️ 70 URLs (CLS issue)", "⚠️ No data (low traffic)"],
    ["Key Events / Conversions", "8,143 (organic)", "0 — not configured"],
    ["GA4 Conversion Tracking", "✅ Active", "❌ Not configured"],
    ["Active Schema Types", "4 (FAQ, Profile, Reviews, Video)", "[ Fill ]"],
  ]),
  ...spacer(1),

  h2("Competitor Site Health Comparison (Semrush)"),
  italic("Data source: Semrush Site Audit dashboard — all competitors audited on same platform"),
  ...spacer(1),
  dataTable([
    ["Domain", "Site Health", "Errors", "Warnings", "Crawlability", "HTTPS", "Int. Linking"],
    ["avanaplasticsurgery.com", "90%", "8", "1,763", "100%", "98%", "87%"],
    ["iconcosmeticcenter.com", "83%", "65", "450", "93%", "98%", "84%"],
    ["care4hairclinic.com", "91%", "8", "280", "96%", "98%", "85%"],
    ["gallardolawyers.com", "98%", "0", "28", "99%", "98%", "95%"],
    ["uniqueaestheticcenter.com", "86%", "2", "1,387", "100%", "18%", "97%"],
    ["bodyaestheticcenter.com", "87%", "7", "273", "96%", "98%", "89%"],
  ]),
  ...spacer(1),
  insight("Avana Plastic Surgery's 90% site health outperforms key competitor iconcosmeticcenter.com (83%) — a meaningful technical advantage. However uniqueaestheticcenter.com has only 18% HTTPS score suggesting major security issues, while Avana scores 98%.", "good"),
  ...spacer(1),

  h2("Shared Opportunities"),
  bullet("Both sites should pursue a unified review generation strategy — plastic surgery reviews in particular carry huge commercial weight."),
  bullet("Cross-linking between the two properties where contextually relevant (e.g. Wellness Plus services recommended post-surgery on Plastic Surgery pages)."),
  bullet("Both sites can benefit from a shared Spanish-language content strategy — the /espanol section on Plastic Surgery is already gaining traction."),
  bullet("Unified local citation cleanup via Semrush Listing Management for all shared or nearby locations."),
  bullet("RealSelf presence is critical for both — verified profiles, active reviews, and Q&A should be prioritized."),
  pageBreak(),

  // ══════════════════════════════════════════════════════════
  // 5. PRIORITY ACTION PLAN
  // ══════════════════════════════════════════════════════════
  sectionDivider("SECTION 5 — PRIORITY ACTION PLAN"),
  ...spacer(1),
  h1("5. Priority Action Plan"),
  body("The following table consolidates the highest-impact recommendations across both sites, to be reviewed and prioritized during the Monday kickoff meeting with Dr. Labrador and Oreste Duarte."),
  ...spacer(1),

  findingsTable([
    ["Priority", "Action Item", "Effort", "Expected Impact"],
    ["High", "Fix 212 pages returning 404 — redirect or restore (Plastic Surgery)", "Medium", "Recover link equity, improve crawl budget, fix user experience"],
    ["High", "Audit & fix 314 crawled-not-indexed pages — improve or consolidate (Plastic Surgery)", "High", "Increase indexed page count, more ranking opportunities"],
    ["High", "Fix 19 failed redirect pages + 1 server error (Plastic Surgery)", "Low", "Remove crawl errors, prevent ranking loss"],
    ["High", "Optimize title tags & meta descriptions on low-CTR high-impression pages (BBL, tummy tuck, mommy makeover)", "Low", "Immediate CTR improvement — potential +50–200% clicks on these pages"],
    ["High", "Build non-branded keyword strategy — procedure + location pages", "High", "Break reliance on brand traffic; capture commercial intent searches"],
    ["High", "E-E-A-T: Add full credentials, certifications, and bios to all doctor pages (YMYL)", "Medium", "Improve Google quality rating; reduce risk of ranking suppression"],
    ["High", "GBP optimization for Miami and Dallas (both sites where applicable)", "Low", "Improve local pack rankings and map visibility"],
    ["Medium", "Fix mobile CLS issues on 70 URLs — add image dimensions, reserve layout space", "Medium", "Pass full CWV mobile — potential ranking boost"],
    ["Medium", "Add missing schema: MedicalBusiness, LocalBusiness, BreadcrumbList", "Medium", "Unlock new rich result types; reinforce local SEO signals"],
    ["Medium", "Fix Video schema: add timezone to uploadDate on 83 items", "Low", "Improve video rich result eligibility and appearance"],
    ["Medium", "Expand Spanish-language content section beyond /lipo-360-en-miami", "Medium", "Capture large Spanish-speaking plastic surgery market"],
    ["Medium", "Audit and fix NAP inconsistencies across all citation directories", "Medium", "Improve local SEO signals and map pack rankings"],
    ["Medium", "Build link acquisition strategy: RealSelf, Healthgrades, medical PR", "High", "Increase domain authority; improve non-brand rankings"],
    ["Low", "Develop content hub / blog with topical cluster strategy (procedures, recovery, FAQs)", "High", "Long-term organic traffic growth; strengthen topical authority"],
    ["Low", "Implement video SEO strategy — leverage existing 112 indexed videos", "Medium", "Video carousels in SERPs; additional visibility channels"],
  ]),
  ...spacer(2),

  h2("Proposed Timeline"),
  dataTable([
    ["Phase", "Focus", "Timeframe"],
    ["Phase 1 — Critical Technical Fixes", "404s, redirects, server errors, E-E-A-T, GBP", "Week 1–2"],
    ["Phase 2 — On-Page & CTR Optimization", "Title tags, meta descriptions, schema additions", "Week 3–4"],
    ["Phase 3 — Content & Keyword Expansion", "Non-brand pages, Spanish content, blog strategy", "Month 2"],
    ["Phase 4 — Authority & Link Building", "RealSelf, Healthgrades, medical PR, citations", "Month 2–3"],
    ["Phase 5 — Monitoring & Iteration", "Weekly GSC/GA review, Authority Labs tracking, reporting", "Ongoing"],
  ]),
  ...spacer(2),

  new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: C.teal, space: 4 } },
    children: [new TextRun({ text: "Report prepared by Javier for Sevenlogik  ·  Confidential  ·  May 2026", font: "Arial", size: 18, italics: true, color: "AAAAAA" })],
    ...sp(240, 120),
  }),
];

// ── BUILD ──────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
      ],
    }],
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: C.navy },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: C.teal },
        paragraph: { spacing: { before: 280, after: 80 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: C.navy },
        paragraph: { spacing: { before: 200, after: 60 }, outlineLevel: 2 } },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.teal, space: 4 } },
          children: [new TextRun({ text: "SEO Audit Report  ·  Avana Plastic Surgery & Avana Wellness Plus  ·  May 2026", font: "Arial", size: 18, color: "888888" })],
          ...sp(0, 80),
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.midGray, space: 4 } },
          tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
          children: [
            new TextRun({ text: "Sevenlogik — Confidential", font: "Arial", size: 18, color: "AAAAAA" }),
            new TextRun({ text: "\tPage ", font: "Arial", size: 18, color: "AAAAAA" }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: "AAAAAA" }),
          ],
          ...sp(80, 0),
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("SEO_Audit_Report_Avana_v2.docx", buf);
  console.log("Done!");
});