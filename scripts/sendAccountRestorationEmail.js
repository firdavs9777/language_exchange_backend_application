/**
 * Send Account Restoration Email
 *
 * Usage:
 *   node scripts/sendAccountRestorationEmail.js <email>
 *   node scripts/sendAccountRestorationEmail.js nozil@mail.ru
 *
 * Sends professional support email notifying user of account restoration
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './config/config.env' });

const userEmail = process.argv[2];

if (!userEmail) {
  console.log('❌ Please provide user email address');
  console.log('Usage: node scripts/sendAccountRestorationEmail.js <email>');
  console.log('Example: node scripts/sendAccountRestorationEmail.js nozil@mail.ru');
  process.exit(1);
}

// Email configuration
const emailConfig = {
  service: 'SendGrid',
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY || ''
  }
};

// Alternative: Use Mailgun if configured
if (process.env.MAILGUN_API_KEY) {
  emailConfig.service = 'Mailgun';
  emailConfig.host = `smtp.mailgun.org`;
  emailConfig.port = 587;
  emailConfig.auth = {
    user: `postmaster@${process.env.MAILGUN_DOMAIN}`,
    pass: process.env.MAILGUN_API_KEY
  };
}

async function sendEmail() {
  try {
    console.log(`\n📧 Sending account restoration email to: ${userEmail}\n`);

    // Create transporter
    const transporter = nodemailer.createTransport(emailConfig);

    // Read HTML template
    const htmlTemplate = fs.readFileSync(
      path.join(__dirname, '../templates/account-restoration-email.html'),
      'utf8'
    );

    // Plain text version
    const textVersion = `
BanaTalk Account Restoration - Important Update

Dear User,

We're writing to let you know that we've investigated and resolved the issue with your BanaTalk account. Your account is now fully active and ready to use!

ACCOUNT STATUS: ✅ ACTIVE
- Email: ${userEmail}
- Status: Fully functional
- All data: Preserved and accessible

WHAT HAPPENED:
Your newly created account experienced temporary login issues within hours of creation. These issues have been fully resolved.

HOW TO ACCESS YOUR ACCOUNT:

1. Open BanaTalk App and tap the Login button
2. Enter your email: ${userEmail}
3. Click "Forgot Password" to set a new password
4. Check your email for the password reset code
5. Set your new password and log in
6. Complete profile setup if needed

SECURITY ENHANCEMENTS:
We've implemented additional security measures:
- Accounts can only be deleted manually by the user
- All account deletions are logged and audited
- Admin accounts cannot be accidentally deleted
- Comprehensive account recovery system in place

NEED HELP?
If you encounter any issues, please contact:
- Email: support@banatalk.com
- In-app Support: Settings → Help & Support

Best regards,
The BanaTalk Support Team
Making language exchange simple and secure

---
This is an automated support message. Please do not reply directly.
For more info, visit: banatalk.com
`;

    // Send email
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@banatalk.com',
      to: userEmail,
      subject: '✅ Your BanaTalk Account Has Been Restored',
      html: htmlTemplate,
      text: textVersion
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('✅ EMAIL SENT SUCCESSFULLY!\n');
    console.log('📊 Email Details:');
    console.log(`   To: ${userEmail}`);
    console.log(`   From: ${mailOptions.from}`);
    console.log(`   Subject: ${mailOptions.subject}`);
    console.log(`   Message ID: ${info.messageId}\n`);

    console.log('📝 Email Contents:');
    console.log('   - Account status confirmation');
    console.log('   - What happened explanation');
    console.log('   - Step-by-step access instructions');
    console.log('   - Security enhancements information');
    console.log('   - Support contact details\n');

    console.log('✅ User should receive email within minutes\n');

  } catch (error) {
    console.error('❌ Failed to send email:');
    console.error(`   Error: ${error.message}\n`);

    if (error.message.includes('SENDGRID_API_KEY')) {
      console.log('📌 Note: SENDGRID_API_KEY not configured');
      console.log('   Add it to your .env file to enable email sending\n');
    }

    process.exit(1);
  }
}

sendEmail();
