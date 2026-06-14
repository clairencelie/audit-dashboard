/**
 * Print/PDF generation for STP and SPA audit documents.
 * Opens a styled HTML page in a new window; user can Ctrl+P / Save as PDF.
 *
 * Customize COMPANY_NAME, AUDIT_CODE, and CITY to match your organization.
 */

import type { AuditProject, AuditProgram, AuditDocument } from '@/types'

const COMPANY_NAME = 'PT. [Nama Perusahaan]'   // Ganti sesuai perusahaan
const AUDIT_CODE   = 'AUDIT'                    // Ganti jika diperlukan (mis. AUDIT-ASM)
const CITY         = 'Jakarta'

// ---- helpers ---------------------------------------------------------------

function longDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function dateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start && !end) return '-'
  const fmt = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'
  return `${fmt(start)} - ${fmt(end)}`
}

/**
 * Convert a block of text (possibly "1. item\n2. item" or plain paragraphs)
 * into numbered <tr> rows suitable for a borderless table.
 */
function toNumberedRows(text: string): string {
  if (!text.trim()) return '<tr><td colspan="2">-</td></tr>'
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.replace(/^\d+[\.\)]\s*/, ''))
  return lines
    .map((line, i) => `<tr>
      <td style="vertical-align:top;white-space:nowrap;padding-right:8px;">${i + 1}.</td>
      <td style="text-align:justify;">${line}</td>
    </tr>`)
    .join('\n')
}

// ---- shared CSS ------------------------------------------------------------

const PAGE_CSS = `
  @page { size: A4 portrait; margin: 2.5cm 2.5cm 2cm 3cm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 1.6;
    color: #000;
    margin: 0;
    padding: 0;
  }
  .page { padding: 2.5cm 2.5cm 2cm 3cm; max-width: 21cm; margin: 0 auto; }
  /* header */
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #000;
    padding-bottom: 8px;
    margin-bottom: 20px;
  }
  .company-block { font-size: 9pt; }
  .company-name { font-size: 16pt; font-weight: bold; }
  .year-badge { font-size: 40pt; font-weight: bold; color: #222; line-height: 1; }
  /* body */
  p { margin: 6px 0; }
  .doc-number { margin-bottom: 2px; }
  .salutation { margin: 18px 0 4px; }
  .section-heading { font-weight: bold; margin: 14px 0 4px; }
  .body-para { text-indent: 2em; text-align: justify; }
  table.num-list { border-collapse: collapse; width: 100%; }
  table.num-list td { padding: 1px 4px; }
  /* signature */
  .signature { margin-top: 40px; }
  .signer-gap { height: 65px; }
  .signer-name { font-weight: bold; text-decoration: underline; }
  /* print button (hidden when printing) */
  .print-btn {
    position: fixed; top: 16px; right: 16px;
    padding: 10px 22px;
    background: #2563eb; color: #fff;
    border: none; border-radius: 6px;
    font-size: 14px; cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,.2);
    z-index: 9999;
  }
  .print-btn:hover { background: #1d4ed8; }
`

function openPrint(title: string, html: string): void {
  const win = window.open('', '_blank', 'width=950,height=750')
  if (!win) {
    alert('Pop-up diblokir browser. Izinkan pop-up untuk halaman ini dan coba lagi.')
    return
  }
  win.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>${PAGE_CSS}</style>
</head>
<body>
  <button class="no-print print-btn" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
  <div class="page">
    ${html}
  </div>
</body>
</html>`)
  win.document.close()
}

// ---- STP -------------------------------------------------------------------

export function printSTP(
  project: AuditProject,
  program: AuditProgram,
  doc: AuditDocument,
): void {
  const theme    = project.audit_theme || 'Pemeriksaan'
  const auditee  = project.auditee
  const auditor  = project.auditor
  const divHead  = project.div_head
  const issued   = longDate(doc.issued_at)
  const year     = new Date(doc.issued_at).getFullYear()

  const recipientLine = auditee?.contact_person
    ? `Bapak/Ibu ${auditee.contact_person} (PIC Unit Kerja ${auditee.name})`
    : auditee?.name ?? '-'

  const auditorLines = `<tr>
    <td style="vertical-align:top;white-space:nowrap;padding-right:8px;">1.</td>
    <td>${auditor?.name ?? '-'}${auditor?.position ? `&nbsp;&nbsp;&nbsp;${auditor.position}` : ''}</td>
  </tr>`

  const body = `
    <div class="doc-header">
      <div class="company-block">
        <div class="company-name">${COMPANY_NAME}</div>
      </div>
      <div class="year-badge">${year}</div>
    </div>

    <p class="doc-number">No: ${doc.document_number.replace('AUDIT', AUDIT_CODE)}</p>
    <p>${CITY}, ${issued}</p>

    <p style="margin-top:18px;">Kepada Yth:</p>
    <p>${recipientLine}</p>
    <p>${COMPANY_NAME}</p>

    <p style="margin-top:14px;"><strong>Hal: Surat Tugas Pemeriksaan ${theme}</strong></p>

    <p class="salutation">Dengan Hormat,</p>

    <p class="body-para">Bersama ini kami informasikan mengenai pemeriksaan <em>${theme}</em> maka kami mohon bantuan dan kerjasama Bapak/Ibu dalam pemeriksaan proses pelaksanaan ini.</p>

    <p class="section-heading">Tujuan Pemeriksaan:</p>
    <table class="num-list">${toNumberedRows(program.objectives || '')}</table>

    <p class="section-heading">Lingkup Pemeriksaan:</p>
    <table class="num-list">${toNumberedRows(program.scope || '')}</table>

    <p style="margin-top:14px;">Periode data: ${dateRange(program.data_period_start, program.data_period_end)}.</p>
    <p>Jangka waktu pemeriksaan <em>(audit)</em>: ${dateRange(program.audit_period_start, program.audit_period_end)}.</p>

    <p class="section-heading">PIC <em>Auditor</em>:</p>
    <table class="num-list">${auditorLines}</table>

    <p style="margin-top:14px;">Untuk kelancaran proses pemeriksaan <em>(audit)</em> ini, mohon untuk memberikan semua informasi data yang diminta oleh <em>auditor</em> dan lain-lain.</p>

    <p class="body-para">Demikian yang dapat kami sampaikan, atas waktu dan bantuannya kami ucapkan terima kasih.</p>

    <div class="signature">
      <p>Salam,</p>
      <div class="signer-gap"></div>
      <p class="signer-name">${divHead?.name ?? '[Nama Kepala Divisi]'}</p>
      <p>Divisi Internal Audit</p>
    </div>
  `

  openPrint(`STP - ${theme}`, body)
}

// ---- SPA -------------------------------------------------------------------

export function printSPA(
  project: AuditProject,
  program: AuditProgram,
  doc: AuditDocument,
): void {
  const theme   = project.audit_theme || 'Pemeriksaan'
  const auditee = project.auditee
  const divHead = project.div_head
  const issued  = longDate(doc.issued_at)
  const year    = new Date(doc.issued_at).getFullYear()

  const recipientLine = auditee?.contact_person
    ? `Bapak/Ibu ${auditee.contact_person} (PIC Unit Kerja ${auditee.name})`
    : auditee?.name ?? '-'

  const body = `
    <div class="doc-header">
      <div class="company-block">
        <div class="company-name">${COMPANY_NAME}</div>
      </div>
      <div class="year-badge">${year}</div>
    </div>

    <p class="doc-number">No: ${doc.document_number.replace('AUDIT', AUDIT_CODE)}</p>
    <p>${CITY}, ${issued}</p>

    <p style="margin-top:18px;">Kepada Yth:</p>
    <p>${recipientLine}</p>
    <p>${COMPANY_NAME}</p>

    <p style="margin-top:14px;"><strong>Hal: Surat Pengantar Audit</strong></p>

    <p class="salutation">Dengan Hormat,</p>

    <p class="body-para">Sehubungan dengan rencana pemeriksaan <em>${theme}</em>, maka dengan ini kami mohon kerjasama Bapak/Ibu (<em>Auditee</em>) untuk menyampaikan diawal kelemahan prosedur dan kontrol termasuk kendala-kendala dalam semua proses kerja di bagian terkait.</p>

    <p>Hal ini perlu dilakukan mempertimbangkan:</p>
    <table class="num-list">
      <tr>
        <td style="vertical-align:top;white-space:nowrap;padding-right:8px;">1.</td>
        <td><em>Auditee</em> adalah pihak yang lebih mengerti mengenai seluruh prosedur dan proses kerja yang berjalan.</td>
      </tr>
      <tr>
        <td style="vertical-align:top;white-space:nowrap;padding-right:8px;">2.</td>
        <td>Keterbatasan auditor dalam memahami kondisi <em>real</em> di lapangan.</td>
      </tr>
      <tr>
        <td style="vertical-align:top;white-space:nowrap;padding-right:8px;">3.</td>
        <td>Tujuan yang sama antara auditor dengan a<em>uditee</em> untuk membuat SOP dan kontrol yang lebih baik untuk kemajuan perusahaan.</td>
      </tr>
    </table>

    <p class="body-para" style="margin-top:12px;">Bapak/Ibu dapat melakukan diskusi internal untuk mengidentifikasi kelemahan - kelemahan dalam kontrol &amp; prosedur kerja yang ada termasuk kendala-kendala yang dihadapi. Peran serta Bapak/Ibu dalam menyempurnakan SOP &amp; Kontrol yang berjalan selama ini sangat kami harapkan demi tercapainya proses yang lebih efektif dan efisien bagi perusahaan.</p>

    <p class="body-para">Kami harapkan peran serta Bapak/Ibu dapat kami terima selama penugasan peninjauan. Semua informasi yang Bapak/Ibu sampaikan kepada Tim Audit terkait hal-hal diatas tidak akan kami laporkan sebagai temuan audit karena hal tersebut merupakan bentuk proaktif auditee dalam membantu Perusahaan menjadi lebih baik.</p>

    <p class="body-para">Demikian yang dapat kami sampaikan, atas kerjasama Bapak/Ibu kami ucapkan terima kasih.</p>

    <div class="signature">
      <p>Salam,</p>
      <div class="signer-gap"></div>
      <p class="signer-name">${divHead?.name ?? '[Nama Kepala Divisi]'}</p>
      <p>Divisi Internal Audit</p>
    </div>
  `

  openPrint(`SPA - ${theme}`, body)
}
