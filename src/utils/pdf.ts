import { jsPDF } from "jspdf";
import QRCode from "qrcode";

export interface CertificateData {
  certId: string;
  studentName: string;
  studentId: string;
  course: string;
  instituteName: string;
  grade: string;
  issueDate: string;
  hash?: string; // filled after PDF generation (second pass not needed — we embed a placeholder QR)
  logoDataUrl?: string;
}

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

/**
 * Generate a professional certificate PDF and return its bytes.
 * The QR code links to /verify?hash=<hash> — we embed the certId URL
 * and update it after the hash is computed (two-pass approach).
 */
export async function generateCertificatePDF(data: CertificateData): Promise<Uint8Array> {
  const verifyUrl = data.hash
    ? `${APP_URL}/verify?hash=${data.hash}`
    : `${APP_URL}/verify?id=${data.certId}`;

  // Generate QR code as data URL
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 150,
    margin: 1,
    color: { dark: "#1e1b4b", light: "#ffffff" },
  });

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // ── Background ────────────────────────────────────────────────────────────
  doc.setFillColor(248, 247, 255);
  doc.rect(0, 0, W, H, "F");

  // Deep indigo border
  doc.setDrawColor(30, 27, 75);
  doc.setLineWidth(3);
  doc.rect(8, 8, W - 16, H - 16);
  doc.setLineWidth(0.8);
  doc.setDrawColor(99, 102, 241);
  doc.rect(12, 12, W - 24, H - 24);

  // Corner ornaments
  const ornament = (x: number, y: number, flip: boolean) => {
    doc.setFillColor(99, 102, 241);
    doc.circle(x + (flip ? -4 : 4), y + (flip ? -4 : 4), 2, "F");
    doc.setFillColor(167, 139, 250);
    doc.circle(x + (flip ? -8 : 8), y + (flip ? -4 : 4), 1.2, "F");
    doc.circle(x + (flip ? -4 : 4), y + (flip ? -8 : 8), 1.2, "F");
  };
  ornament(12, 12, false);
  ornament(W - 12, 12, true);
  ornament(12, H - 12, false);
  ornament(W - 12, H - 12, true);

  // Header band
  doc.setFillColor(30, 27, 75);
  doc.rect(12, 12, W - 24, 22, "F");

  // CertChain logo text in header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("🔗 CERTCHAIN", 22, 26);

  // Tagline
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(199, 210, 254);
  doc.text("Tamper-Proof Certificate on Blockchain", W / 2, 26, { align: "center" });

  // Institute logo (if provided)
  if (data.logoDataUrl) {
    try {
      doc.addImage(data.logoDataUrl, "PNG", W - 50, 15, 16, 16);
    } catch (_) { /* skip if image format unsupported */ }
  }

  // ── Certificate Title ─────────────────────────────────────────────────────
  doc.setTextColor(30, 27, 75);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("Certificate of Achievement", W / 2, 58, { align: "center" });

  // Decorative line under title
  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(0.5);
  doc.line(W / 2 - 70, 63, W / 2 + 70, 63);

  // ── Presented to ─────────────────────────────────────────────────────────
  doc.setFont("helvetica", "italic");
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text("This is to certify that", W / 2, 76, { align: "center" });

  // Student Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(30, 27, 75);
  doc.text(data.studentName, W / 2, 92, { align: "center" });

  // Gold underline for name
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(1.2);
  const nameWidth = doc.getTextWidth(data.studentName);
  doc.line(W / 2 - nameWidth / 2 - 5, 95, W / 2 + nameWidth / 2 + 5, 95);

  // ── Body text ────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "italic");
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text("has successfully completed", W / 2, 107, { align: "center" });

  // Course
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(79, 70, 229);
  doc.text(data.course, W / 2, 120, { align: "center" });

  // Issued by
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text(`Issued by ${data.instituteName}`, W / 2, 132, { align: "center" });

  // ── Details row ──────────────────────────────────────────────────────────
  const col1 = 55, col2 = W / 2, col3 = W - 55;
  const labelY = 150, valY = 157;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);

  doc.text("STUDENT ID", col1, labelY, { align: "center" });
  doc.text("GRADE / SCORE", col2, labelY, { align: "center" });
  doc.text("DATE OF ISSUE", col3, labelY, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 27, 75);
  doc.text(data.studentId, col1, valY, { align: "center" });
  doc.text(data.grade, col2, valY, { align: "center" });
  doc.text(data.issueDate, col3, valY, { align: "center" });

  // Dividers between detail columns
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(col2 - 50, 144, col2 - 50, 162);
  doc.line(col2 + 50, 144, col2 + 50, 162);

  // ── Footer: QR code + cert ID ─────────────────────────────────────────────
  // QR code (right side)
  doc.addImage(qrDataUrl, "PNG", W - 48, H - 55, 34, 34);
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text("Scan to verify", W - 31, H - 19, { align: "center" });

  // Signature line (left side)
  doc.setDrawColor(30, 27, 75);
  doc.setLineWidth(0.4);
  doc.line(25, H - 28, 90, H - 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 27, 75);
  doc.text(data.instituteName, 57, H - 23, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("Authorized Signatory", 57, H - 18, { align: "center" });

  // Cert ID and blockchain badge
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Certificate ID: ${data.certId}`, W / 2, H - 27, { align: "center" });
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.3);
  doc.roundedRect(W / 2 - 30, H - 22, 60, 8, 2, 2, "FD");
  doc.setTextColor(21, 128, 61);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("✓ Verified on Blockchain", W / 2, H - 17, { align: "center" });

  return doc.output("arraybuffer") as unknown as Uint8Array;
}

/**
 * Trigger browser download of the PDF bytes.
 */
export function downloadPDF(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Generate a short unique certificate ID.
 */
export function generateCertId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 12 }, (_, i) =>
    i > 0 && i % 4 === 0 ? "-" + chars[Math.floor(Math.random() * chars.length)]
                          : chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}
