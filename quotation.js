const express = require('express');
const router  = express.Router();
const { generateQuotationPDF }    = require('./pdfService');
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
  const { clientName, clientEmail, quotationItems } = body;
  if (!clientName)  return 'clientName is required';
  if (!clientEmail) return 'clientEmail is required';
  if (!Array.isArray(quotationItems) || quotationItems.length === 0)
    return 'quotationItems must be a non-empty array';
  for (const [i, item] of quotationItems.entries()) {
    if (!item.name)        return `quotationItems[${i}].name is required`;
    if (!item.grammage)    return `quotationItems[${i}].grammage is required`;
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
    clientName, clientCompany, clientEmail,
    clientAddress, clientPhone,
    createdAt = today(),
    quotationItems,
  } = req.body;

  const quotationNumber = `COT-${Date.now()}`;

  const pdfBuffer = await generateQuotationPDF({
    clientName, clientCompany, clientEmail,
    clientAddress, clientPhone,
    createdAt, quotationNumber, quotationItems,
  });

  await sendEmailWithAttachment({
    to: clientEmail,
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
    clientName, clientCompany, clientEmail,
    clientAddress, clientPhone,
    createdAt = today(),
    quotationItems,
  } = req.body;

  const pdfBuffer = await generateQuotationPDF({
    clientName, clientCompany, clientEmail,
    clientAddress, clientPhone,
    createdAt,
    quotationNumber: `PREVIEW-${Date.now()}`,
    quotationItems,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
  res.send(pdfBuffer);
});


// ── GET /api/quotation/debug-image?imageName=uvas-pasas.png ──────────────────
// Tells you exactly what URL is built and whether it fetches successfully.
// Use this to diagnose image loading issues without generating a full PDF.
router.get('/debug-image', async (req, res) => {
  const { imageName } = req.query;
  if (!imageName) return res.status(400).json({ error: 'imageName query param required' });

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const folder    = process.env.CLOUDINARY_FOLDER || 'spice-products';

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