const nodemailer = require('nodemailer');

// async..await is not allowed in global scope, must use a wrapper
const sendEmail = async (options) => {
  let transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD
    }
  });

  // send mail with defined transport object
  const message = {
    from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    text: options.message
  };

  console.log(options.email)
  const info = await transporter.sendMail(message);
  console.log('Message sent: %s', info.messageId);
};
module.exports = sendEmail;
