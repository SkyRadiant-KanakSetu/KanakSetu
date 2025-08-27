import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

export async function createTransport(){
  const host = process.env.SMTP_HOST;
  if(!host) return null; // disabled until configured
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
  return transporter;
}

export async function receiptPdfBuffer({ donation, institution }){
  return await new Promise((resolve, reject)=>{
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', d => chunks.append ? chunks.append(d) : chunks.push(d));
    doc.on('end', ()=> resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

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
    doc.end();
  });
}

export async function sendReceiptEmail({ to, donation, institution }){
  const tx = await createTransport();
  if(!tx) return { ok: false, reason: 'smtp_not_configured' };
  const from = process.env.EMAIL_FROM || 'Kanak Setu <noreply@kanaksetu.local>';
  const pdf = await receiptPdfBuffer({ donation, institution });
  const info = await tx.sendMail({
    from,
    to,
    subject: `Donation Receipt #${donation.id}`,
    text: `Thank you for your donation of ₹${donation.amount_inr}. Your receipt ID is ${donation.id}.`,
    attachments: [{ filename: `receipt-${donation.id}.pdf`, content: pdf }]
  });
  return { ok: true, messageId: info.messageId };
}
