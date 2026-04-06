const nodemailer = require('nodemailer');

function createTransporter(user, pass) {
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.lacasitadelsabor.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}
function setSMTPConfig(role) {
  switch (role) {
    case 'seller':
      return createTransporter(process.env.SMTP_SELLER_USER, process.env.SMTP_SELLER_PASS); 
    case 'remission':
      return createTransporter(process.env.SMTP_REMISSION_USER, process.env.SMTP_REMISSION_PASS);
    case 'security':
      return createTransporter(process.env.SMTP_SECURITY_USER, process.env.SMTP_SECURITY_PASS);
    default:
      throw new Error('Invalid role');
  }
}

/**
 * Sends an email with one or more attachments.
 * @param {{ to, subject, html, attachments: Array<{filename, content, contentType}> }} opts
 */
async function sendEmailWithAttachment({ to, subject, html, attachments = [] }, role) {
  const transporter = setSMTPConfig(role);

  var user = '';

  switch (role) {
    case 'seller':
      user = process.env.SMTP_SELLER_USER;
      break;
    case 'remission':
      user = process.env.SMTP_REMISSION_USER;
      break;
    case 'security':
      user = process.env.SMTP_SECURITY_USER;
      break;
    default:
      throw new Error('Invalid role');
  }

  const info = await transporter.sendMail({
    from: `"Casita del Sabor" <${user}>`,
    to,
    subject,
    html,
    attachments,
  });
  return info;
}

module.exports = { sendEmailWithAttachment };
