const sgMail = require('@sendgrid/mail');

const sendEmail = async (options) => {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const msg = {
    to: options.email,
    from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`, // Verified sender
    subject: options.subject,
    text: options.message,
    html: options.html, // Optional: if you want to send HTML content
  };

  try {
    const response = await sgMail.send(msg);
    console.log('Email sent:', response[0].statusCode);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

module.exports = sendEmail;
