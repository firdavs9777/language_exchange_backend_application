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