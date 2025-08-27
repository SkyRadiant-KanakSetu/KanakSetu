import PDFDocument from 'pdfkit';
import { config } from './config.js';

export function streamReceiptPDF({ donation, institution }, res){
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="receipt-${donation.id}.pdf"`);
  doc.pipe(res);

  const issuer = process.env.RECEIPT_ISSUER || 'Kanak Setu';
  const address = process.env.RECEIPT_ADDRESS || 'India';

  doc.fontSize(20).text(issuer, { align: 'left' });
  doc.moveDown(0.2);
  doc.fontSize(10).text(address);
  doc.moveDown();
  doc.moveTo(50, 120).lineTo(545, 120).stroke();

  doc.moveDown();
  doc.fontSize(16).text('Donation Receipt', { align: 'center' });
  doc.moveDown();

  doc.fontSize(12);
  doc.text(`Receipt ID: ${donation.id}`);
  doc.text(`Date: ${new Date(donation.created_at).toLocaleString()}`);
  doc.text(`Institution: ${institution?.name || donation.institution_id}`);
  doc.text(`Donor: ${donation.donor_name || 'Anonymous'}`);
  doc.text(`Email: ${donation.donor_email || '-'}`);
  doc.text(`Amount (INR): ₹${donation.amount_inr}`);
  doc.text(`Gold Credited (g): ${donation.grams}`);
  doc.text(`Provider Ref: ${donation.provider_ref}`);
  doc.moveDown();
  doc.text('Note: This receipt acknowledges a donation converted to allocated gold via a direct-settlement provider.', { width: 460 });

  doc.end();
}
