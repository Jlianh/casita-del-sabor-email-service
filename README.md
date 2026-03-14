# Spice Quotation API

Minimal Node.js + Express API. Receives a cart from the frontend, generates a PDF quotation with product images, and emails it to the client.

## Stack

| | |
|---|---|
| Server | Express (Vercel Serverless) |
| PDF | pdf-lib (pure JS) |
| Email | Nodemailer (Gmail) |
| Images | Cloudinary (free tier) |

## Setup

```bash
npm install
cp .env.example .env   # fill in SMTP + Cloudinary values
npm run dev
```

## Environment Variables

| Variable | Description |
|---|---|
| `SMTP_HOST` | SMTP server (`smtp.gmail.com`) |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASS` | Gmail App Password |
| `CLOUDINARY_CLOUD_NAME` | From cloudinary.com dashboard |
| `CLOUDINARY_FOLDER` | Folder where product images live (default: `spice-products`) |

> **Gmail App Password:** myaccount.google.com → Security → 2FA → App Passwords

## Endpoints

### `POST /api/quotation`
Generates PDF and sends it to the client's email.

Add `?download=true` to also stream the PDF back in the response.

### `POST /api/quotation/preview`
Same PDF generation but **no email sent** — returns PDF inline. Use this during development.

## Request Body

```json
{
  "clientName":    "Julian",
  "clientCompany": "Casita CV",
  "clientEmail":   "julian@example.com",
  "clientAddress": "Carrera 87N # 62 sur",
  "clientPhone":   "3042647558",
  "createdAt":     "2026-03-13",
  "quotationItems": [
    {
      "productId": 1,
      "name":      "Adobo Sazonador Completo",
      "grammage":  "30 g",
      "quantity":  1,
      "imageName": "sazonador-completo.jpg"
    }
  ]
}
```

`imageName` is the filename only — the API builds the Cloudinary URL internally.

## Project Structure

```
src/
├── app.js                  # Entry point
├── routes/
│   └── quotation.js        # POST /api/quotation, /api/quotation/preview
└── services/
    ├── pdfService.js       # pdf-lib quotation builder
    └── emailService.js     # Nodemailer sender
```
