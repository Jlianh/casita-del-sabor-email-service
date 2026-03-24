const express = require('express');
const router = express.Router();
const { generateQuotationPDF, generateBillPDF } = require('./pdfService');
const { sendEmailWithAttachment } = require('./emailService');

/**
 * Validates the incoming body.
 * Expected shape:
 * {
 *   clientName:    string,
 *   clientCompany: string,
 *   clientEmail:   string,
 *   clientAddress: string,
 *   clientPhone:   string,
 *   createdAt:     string  ("2026-03-13"),
 *   quotationItems: [
 *     { productId, name, grammage, quantity, imageName }
 *   ]
 * }
 */
function validate(body) {
  const { clientName, clientEmail, clientAddress, clientCity, clientId, quotationItems, clientPhone } = body;
  if (!clientName) return 'clientName is required';
  if (!clientEmail) return 'clientEmail is required';
  if (!clientAddress) return 'clientAddress is required';
  if (!clientCity) return 'clientCity is required';
  if (!clientId) return 'clientId is required';
  if (!clientPhone) return 'clientPhone is required';
  if (!Array.isArray(quotationItems) || quotationItems.length === 0)
    return 'quotationItems must be a non-empty array';
  for (const [i, item] of quotationItems.entries()) {
    if (!item.name) return `quotationItems[${i}].name is required`;
    if (!item.grammage) return `quotationItems[${i}].grammage is required`;
    if (item.quantity == null) return `quotationItems[${i}].quantity is required`;
  }
  return null;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// ── POST /api/quotation ───────────────────────────────────────────────────────
// Generates the PDF and emails it to the client.
// Add ?download=true to also stream the PDF back in the response.
router.post('/', async (req, res) => {
  const err = validate(req.body);
  if (err) return res.status(400).json({ error: err });

  const {
   clientName, clientEmail, clientAddress, clientCity, clientId,  clientPhone,
    createdAt = today(),
    quotationItems,
  } = req.body;

  const quotationNumber = `COT-${Date.now()}`;

  const pdfBuffer = await generateQuotationPDF({
    clientName, clientEmail, clientAddress, clientCity, clientId, quotationItems, clientPhone, createdAt,
    quotationNumber, quotationItems,
  });

  await sendEmailWithAttachment({
    to: [clientEmail, "lacasitadelsabor@yahoo.com"],
    subject: `Tu cotizacion ${quotationNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;color:#222;">
        <div style="background:#bc1a18;padding:24px 32px;border-radius:6px 6px 0 0;">
          <h1 style="margin:0;color:#fff;font-size:22px;">Cotizacion ${quotationNumber}</h1>
        </div>
        <div style="padding:24px 32px;border:1px solid #eee;border-top:none;border-radius:0 0 6px 6px;">
          <p>Hola <strong>${clientName}</strong>,</p>
          <p>Adjunto encontraras tu cotizacion con <strong>${quotationItems.length}</strong> referencia(s).</p>
          <p>Un asesor se pondra en contacto pronto para confirmar disponibilidad y precios.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;"/>
          <p style="font-size:12px;color:#999;">Correo generado automaticamente.</p>
        </div>
      </div>
    `,
    attachments: [{
      filename: `${quotationNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }],
  });

  if (req.query.download === 'true') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quotationNumber}.pdf"`);
    return res.send(pdfBuffer);
  }

  res.json({
    message: `Cotizacion ${quotationNumber} enviada a ${clientEmail}`,
    quotationNumber,
  });
});

// ── POST /api/quotation/preview ───────────────────────────────────────────────
// Returns the PDF inline — no email sent. Use during development.
router.post('/preview', async (req, res) => {
  const err = validate(req.body);
  if (err) return res.status(400).json({ error: err });

  const {
    clientName, clientEmail, clientAddress, clientCity, clientId, clientPhone,
    createdAt = today(), 
    quotationItems,
  } = req.body;

  const pdfBuffer = await generateQuotationPDF({
    clientName, clientCompany, clientEmail,
    clientAddress, clientPhone, clientId, clientCity,
    createdAt,
    quotationNumber: `PREVIEW-${Date.now()}`,
    quotationItems,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
  res.send(pdfBuffer);
});

function normalizePct(value) {
  if (value == null || Number.isNaN(Number(value))) return 0;
  const n = Number(value);
  return n <= 1 ? n : n / 100;
}

function calculateBill(bill) {

  const items = bill.billItems || [];

  const normalizedItems = items.map((item) => {

    const quantity = Number(item.quantity) || 0;
    const unitaryPrice = Number(item.unitaryPrice) || 0;

    const ivaPct = normalizePct(item.iva);

    // 🔥 FIX CLAVE
    const discountPct = item.discount;

    const base = quantity * unitaryPrice;

    const discountValue = base * discountPct/100;
    const baseAfterDiscount = base - discountValue;

    const ivaValue = baseAfterDiscount * ivaPct;

    const totalPrice = baseAfterDiscount + ivaValue;

    return {
      ...item,
      base,
      discountValue,
      ivaValue,
      totalPrice,
    };
  });

  const subtotal = normalizedItems.reduce((sum, i) => sum + i.base, 0);
  const discount = normalizedItems.reduce((sum, i) => sum + i.discountValue, 0);
  const totalIva = normalizedItems.reduce((sum, i) => sum + i.ivaValue, 0);
  const totalOperation = normalizedItems.reduce((sum, i) => sum + i.totalPrice, 0);

  const reteFuente = totalOperation * normalizePct(bill.reteFuente/100);
  const reteica = totalOperation * normalizePct(bill.reteica/1000);

  const totalLessRetentions = totalOperation - reteFuente - reteica;

  return {
    billItems: normalizedItems,
    subtotal,
    discount,
    totalIva,
    totalOperation,
    reteFuente,
    reteica,
    totalLessRetentions,
  };
}

function validateBill(body) {
  if (!body.clientName) return 'clientName is required';
  if (!body.clientEmail) return 'clientEmail is required';
  if (!body.clientId) return 'clientId is required';
  if (!body.createdBy) return 'createdBy is required';

  if (!Array.isArray(body.billItems) || body.billItems.length === 0) return 'billItems must be a non-empty array';
  for (const [i, item] of body.billItems.entries()) {
    if (!item.name) return `billItems[${i}].name is required`;
    if (item.quantity == null) return `billItems[${i}].quantity is required`;
    if (item.unitaryPrice == null) return `billItems[${i}].unitaryPrice is required`;
  }
  return null;
}

// ── POST /api/bill ─────────────────────────────────────────────────────────
router.post('/bill', async (req, res) => {
  const err = validateBill(req.body);
  if (err) return res.status(400).json({ error: err });

  const {
    clientName, clientCity, clientEmail,
    clientAddress, clientPhone, clientId,
    createdAt = today(),
    billItems, createdBy, remisionNumber
  } = req.body;

  const billNumber = `FACT-${Date.now()}`;
  const computed = calculateBill({ ...req.body, billItems });

  const pdfBuffer = await generateBillPDF({
    clientName, clientCity, clientEmail,
    clientAddress, clientPhone, clientId, createdAt,
    billNumber, createdBy, remisionNumber,
    billItems: computed.billItems,
    subtotal: computed.subtotal,
    discount: computed.discount,
    totalIva: computed.totalIva,
    totalOperation: computed.totalOperation,
    reteFuente: computed.reteFuente,
    reteIva: computed.reteIva,
    reteica: computed.reteica,
    totalLessRetentions: computed.totalLessRetentions,
  });

  await sendEmailWithAttachment({
    to: [clientEmail, 'lacasitadelsabor@yahoo.com'],
    subject: `Remision ${remisionNumber}`,
    html: `<p>Adjunto encontrará la remision ${remisionNumber}.</p>`,
    attachments: [{ filename: `${remisionNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
  });

  if (req.query.download === 'true') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${remisionNumber}.pdf"`);
    return res.send(pdfBuffer);
  }

  res.json({
    message: `Remision ${remisionNumber} enviada a ${clientEmail}`,
    remisionNumber,
    totals: computed,
  });
});

// ── POST /api/bill/preview ──────────────────────────────────────────────────
router.post('/bill/preview', async (req, res) => {
  const err = validateBill(req.body);
  if (err) return res.status(400).json({ error: err });

  const {
    clientName, clientCompany, clientEmail,
    clientAddress, clientPhone, clientId,
    createdAt = today(), createdBy,
    billItems,
  } = req.body;

  const billNumber = `PREVIEW-${Date.now()}`;
  const computed = calculateBill({ ...req.body, billItems });

  const pdfBuffer = await generateBillPDF({
    clientName, clientCompany, clientEmail,
    clientAddress, clientPhone, clientId, createdAt, createdBy, 
    billNumber,
    billItems: computed.billItems,
    subtotal: computed.subtotal,
    discount: computed.discount,
    totalIva: computed.totalIva,
    totalOperation: computed.totalOperation,
    reteFuente: computed.reteFuente,
    reteIva: computed.reteIva,
    reteica: computed.reteica,
    totalLessRetentions: computed.totalLessRetentions,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="preview-bill.pdf"');
  res.send(pdfBuffer);
});


// ── GET /api/quotation/debug-image?imageName=uvas-pasas.png ──────────────────
// Tells you exactly what URL is built and whether it fetches successfully.
// Use this to diagnose image loading issues without generating a full PDF.
router.get('/debug-image', async (req, res) => {
  const { imageName } = req.query;
  if (!imageName) return res.status(400).json({ error: 'imageName query param required' });

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const folder = process.env.CLOUDINARY_FOLDER || 'spice-products';

  if (!cloudName) return res.status(500).json({ error: 'CLOUDINARY_CLOUD_NAME not set' });

  const url = `https://res.cloudinary.com/${cloudName}/image/upload/${folder}/${imageName}`;

  try {
    const fetchRes = await fetch(url);
    const contentType = fetchRes.headers.get('content-type');
    const buffer = Buffer.from(await fetchRes.arrayBuffer());

    res.json({
      url,
      status: fetchRes.status,
      ok: fetchRes.ok,
      contentType,
      bytes: buffer.length,
      hint: fetchRes.ok
        ? 'URL is reachable — if images still fail to embed, check the contentType above'
        : 'URL returned non-200 — check your folder name and that the file is uploaded to Cloudinary',
    });
  } catch (err) {
    res.status(500).json({ url, error: err.message });
  }
});

module.exports = router;