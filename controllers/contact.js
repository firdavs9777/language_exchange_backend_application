const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const sendEmail = require('../utils/sendEmail');

/**
 * @desc    Send contact form email
 * @route   POST /api/v1/contact/send
 * @access  Public
 */
exports.sendContactEmail = asyncHandler(async (req, res, next) => {
  const { name, email, subject, message } = req.body;

  // Validation (should be handled by validator, but double-check here)
  if (!name || !email || !message) {
    return next(new ErrorResponse('Name, email, and message are required', 400));
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return next(new ErrorResponse('Invalid email format', 400));
  }

  // Sanitize inputs to prevent XSS
  const sanitizedName = name.trim().substring(0, 200);
  const sanitizedEmail = email.trim().toLowerCase();
  const sanitizedSubject = subject ? subject.trim().substring(0, 200) : 'Contact from Portfolio';
  const sanitizedMessage = message.trim().substring(0, 5000);

  // Prepare email content
  const emailSubject = sanitizedSubject || 'Contact from Portfolio';
  
  const emailText = `
New Contact Form Submission

Name: ${sanitizedName}
Email: ${sanitizedEmail}
Subject: ${emailSubject}

Message:
${sanitizedMessage}

---
This message was sent from the contact form on your portfolio website.
  `.trim();

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .field { margin-bottom: 15px; }
        .field-label { font-weight: bold; color: #555; }
        .field-value { margin-top: 5px; padding: 10px; background-color: white; border-left: 3px solid #4CAF50; }
        .message-box { margin-top: 20px; padding: 15px; background-color: white; border-left: 3px solid #2196F3; }
        .footer { margin-top: 20px; padding: 15px; text-align: center; color: #777; font-size: 12px; border-top: 1px solid #ddd; }
        .reply-button { display: inline-block; margin-top: 15px; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>📧 New Contact Form Submission</h2>
        </div>
        <div class="content">
          <div class="field">
            <div class="field-label">👤 Name:</div>
            <div class="field-value">${sanitizedName}</div>
          </div>
          <div class="field">
            <div class="field-label">📧 Email:</div>
            <div class="field-value">
              <a href="mailto:${sanitizedEmail}">${sanitizedEmail}</a>
            </div>
          </div>
          <div class="field">
            <div class="field-label">📝 Subject:</div>
            <div class="field-value">${emailSubject}</div>
          </div>
          <div class="message-box">
            <div class="field-label">💬 Message:</div>
            <div style="margin-top: 10px; white-space: pre-wrap;">${sanitizedMessage.replace(/\n/g, '<br>')}</div>
          </div>
          <div style="margin-top: 20px;">
            <a href="mailto:${sanitizedEmail}?subject=Re: ${encodeURIComponent(emailSubject)}" class="reply-button">
              Reply to ${sanitizedName}
            </a>
          </div>
        </div>
        <div class="footer">
          <p>This message was sent from the contact form on your portfolio website.</p>
          <p>Sent at: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    // Get recipient email from environment
    const recipientEmail = process.env.CONTACT_RECIPIENT_EMAIL || process.env.FROM_EMAIL;
    
    if (!recipientEmail) {
      console.error('❌ CONTACT_RECIPIENT_EMAIL not configured');
      return next(new ErrorResponse('Contact form is not properly configured', 500));
    }

    // Send email via Mailgun
    const mailgunResponse = await sendEmail({
      email: recipientEmail,
      subject: emailSubject,
      message: emailText,
      html: emailHtml,
      replyTo: sanitizedEmail // Allow direct reply to sender
    });

    console.log(`✅ Contact form email sent from ${sanitizedEmail} to ${recipientEmail}`);

    res.status(200).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        messageId: mailgunResponse.id || 'sent'
      }
    });

  } catch (error) {
    console.error('❌ Error sending contact form email:', error);
    
    // Don't expose internal errors to client
    return next(new ErrorResponse(
      'Failed to send email. Please try again later.',
      500
    ));
  }
});

