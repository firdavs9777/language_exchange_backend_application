const formData = require('form-data');
const Mailgun = require('mailgun.js');

const sendEmail = async (options) => {
  const mailgun = new Mailgun(formData);
  
  // Determine API URL based on region
  const apiUrl = process.env.MAILGUN_REGION === 'eu' 
    ? 'https://api.eu.mailgun.net' 
    : 'https://api.mailgun.net';
  
  const mg = mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY,
    url: apiUrl
  });

  const messageData = {
    from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
    to: options.email,
    subject: options.subject,
  };

  // Add reply-to if provided (for contact forms)
  if (options.replyTo) {
    messageData['h:Reply-To'] = options.replyTo;
  }

  // Add List-Unsubscribe headers (RFC 8058) when a per-user unsubscribe URL
  // is provided. Transactional emails (verification/reset/security) must
  // NOT pass this — only promotional/digest mail is eligible.
  if (options.unsubscribeUrl) {
    messageData['h:List-Unsubscribe'] = `<${options.unsubscribeUrl}>`;
    messageData['h:List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  // Add HTML and text (text is fallback for email clients that don't support HTML)
  if (options.html) {
    messageData.html = options.html;
    messageData.text = options.message || 'Please view this email in an HTML-compatible email client.';
  } else {
    messageData.text = options.message;
  }

  try {
    const response = await mg.messages.create(process.env.MAILGUN_DOMAIN, messageData);
    console.log('✅ Email sent successfully:', response.id);
    return response;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
};

module.exports = sendEmail;