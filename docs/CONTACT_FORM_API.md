# Contact Form API - Complete Implementation Guide

## ✅ Implementation Complete!

Your contact form API endpoint is now fully implemented and ready to use!

---

## 📍 Endpoint

**URL:** `https://api.banatalk.com/api/v1/contact/send`  
**Method:** `POST`  
**Content-Type:** `application/json`  
**Access:** Public (no authentication required)

---

## 📝 Request Format

### Request Body
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Project Inquiry",
  "message": "Hello, I'm interested in working with you..."
}
```

### Field Requirements

| Field | Type | Required | Max Length | Description |
|-------|------|----------|------------|-------------|
| `name` | string | ✅ Yes | 200 chars | Sender's full name |
| `email` | string | ✅ Yes | 255 chars | Valid email address |
| `subject` | string | ❌ No | 200 chars | Email subject (defaults to "Contact from Portfolio") |
| `message` | string | ✅ Yes | 5000 chars | Message content (min 10 chars) |

---

## ✅ Success Response (200 OK)

```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "messageId": "mailgun-message-id-here"
  }
}
```

---

## ❌ Error Responses

### 400 Bad Request - Validation Error
```json
{
  "success": false,
  "error": "Name, email, and message are required"
}
```

### 400 Bad Request - Invalid Email
```json
{
  "success": false,
  "error": "Invalid email format"
}
```

### 429 Too Many Requests - Rate Limit
```json
{
  "success": false,
  "error": "Too many contact requests, please try again after 15 minutes."
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to send email. Please try again later."
}
```

---

## 🔒 Security Features

### ✅ Implemented

1. **Input Validation**
   - Name: 2-200 characters, letters/spaces/hyphens only
   - Email: Valid email format, normalized
   - Subject: Optional, max 200 characters
   - Message: 10-5000 characters

2. **XSS Protection**
   - All inputs are escaped using `escape()`
   - HTML sanitization in email template

3. **Rate Limiting**
   - 5 requests per 15 minutes per IP address
   - Prevents spam and abuse

4. **Input Sanitization**
   - Trimming whitespace
   - Length limits enforced
   - Email normalization

5. **Error Handling**
   - Internal errors not exposed to client
   - Proper error logging

---

## 📧 Email Features

### Email Content

The email sent includes:
- **From:** BanaTalk <noreply@banatalk.com>
- **To:** Your email (fmutalipov7@gmail.com)
- **Reply-To:** Sender's email (allows direct reply)
- **Subject:** User's subject or "Contact from Portfolio"
- **Format:** Beautiful HTML email with:
  - Professional styling
  - Sender information
  - Message content
  - Reply button
  - Timestamp

### Email Template

The email is sent as a beautifully formatted HTML email with:
- Header with green background
- Organized field display
- Message box with blue accent
- Reply button that opens email client
- Footer with timestamp

---

## 🧪 Testing

### Using cURL

```bash
curl -X POST https://api.banatalk.com/api/v1/contact/send \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "subject": "Test Subject",
    "message": "This is a test message from the contact form."
  }'
```

### Using JavaScript/Fetch

```javascript
async function sendContactForm(name, email, subject, message) {
  try {
    const response = await fetch('https://api.banatalk.com/api/v1/contact/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        email,
        subject,
        message
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Message sent successfully!', data.data.messageId);
      return data;
    } else {
      console.error('❌ Error:', data.error);
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
    throw error;
  }
}

// Usage
sendContactForm(
  'John Doe',
  'john@example.com',
  'Project Inquiry',
  'Hello, I would like to discuss a project...'
);
```

### Using React/Next.js

```jsx
import { useState } from 'react';

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch('https://api.banatalk.com/api/v1/contact/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setStatus({ type: 'success', message: 'Message sent successfully!' });
        setFormData({ name: '', email: '', subject: '', message: '' });
      } else {
        setStatus({ type: 'error', message: data.error });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to send message. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        required
      />
      <input
        type="text"
        placeholder="Subject (optional)"
        value={formData.subject}
        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
      />
      <textarea
        placeholder="Message"
        value={formData.message}
        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
        required
        minLength={10}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send Message'}
      </button>
      {status && (
        <div className={status.type === 'success' ? 'success' : 'error'}>
          {status.message}
        </div>
      )}
    </form>
  );
}
```

---

## ⚙️ Configuration

### Environment Variables

Add to your `.env` file:

```env
# Contact Form Recipient Email
CONTACT_RECIPIENT_EMAIL=fmutalipov7@gmail.com

# Mailgun (already configured)
MAILGUN_API_KEY=your-key-here
MAILGUN_DOMAIN=banatalk.com
MAILGUN_REGION=us
FROM_NAME=BanaTalk
FROM_EMAIL=noreply@banatalk.com
```

**Note:** If `CONTACT_RECIPIENT_EMAIL` is not set, it will default to `FROM_EMAIL`.

---

## 📁 Files Created/Modified

### New Files
- ✅ `controllers/contact.js` - Contact form controller
- ✅ `routes/contact.js` - Contact form routes
- ✅ `validators/contactValidator.js` - Validation rules

### Modified Files
- ✅ `server.js` - Added contact route
- ✅ `middleware/rateLimiter.js` - Added contact rate limiter
- ✅ `utils/sendEmail.js` - Added replyTo support
- ✅ `config/config.env` - Added CONTACT_RECIPIENT_EMAIL

---

## 🚀 Deployment

### 1. Update Environment Variables

On your production server, add to `.env`:

```bash
CONTACT_RECIPIENT_EMAIL=fmutalipov7@gmail.com
```

### 2. Deploy Files

```bash
# Copy new files to server
scp controllers/contact.js root@your-server:/path/to/backend/controllers/
scp routes/contact.js root@your-server:/path/to/backend/routes/
scp validators/contactValidator.js root@your-server:/path/to/backend/validators/
scp middleware/rateLimiter.js root@your-server:/path/to/backend/middleware/
scp utils/sendEmail.js root@your-server:/path/to/backend/utils/
scp server.js root@your-server:/path/to/backend/
```

### 3. Restart Server

```bash
pm2 restart language-app
```

### 4. Test

```bash
curl -X POST https://api.banatalk.com/api/v1/contact/send \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","message":"Test message"}'
```

---

## 📊 Monitoring

### Check Logs

```bash
pm2 logs language-app | grep "contact"
```

**Expected logs:**
```
✅ Contact form email sent from test@test.com to fmutalipov7@gmail.com
```

### Check Mailgun Dashboard

1. Go to Mailgun dashboard
2. Check "Sending" → "Logs"
3. Verify emails are being sent
4. Check delivery status

---

## 🎯 Frontend Integration

### HTML Form Example

```html
<form id="contactForm">
  <input type="text" name="name" placeholder="Your Name" required>
  <input type="email" name="email" placeholder="Your Email" required>
  <input type="text" name="subject" placeholder="Subject (optional)">
  <textarea name="message" placeholder="Your Message" required minlength="10"></textarea>
  <button type="submit">Send Message</button>
</form>

<script>
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  
  const response = await fetch('https://api.banatalk.com/api/v1/contact/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: formData.get('name'),
      email: formData.get('email'),
      subject: formData.get('subject'),
      message: formData.get('message')
    })
  });
  
  const data = await response.json();
  alert(data.success ? 'Message sent!' : data.error);
});
</script>
```

---

## ✅ Features Summary

- ✅ **Public endpoint** - No authentication required
- ✅ **Input validation** - Comprehensive validation rules
- ✅ **XSS protection** - All inputs escaped
- ✅ **Rate limiting** - 5 requests per 15 minutes
- ✅ **Beautiful emails** - HTML formatted with reply button
- ✅ **Error handling** - Proper error responses
- ✅ **Logging** - All submissions logged
- ✅ **Reply-To** - Direct reply to sender
- ✅ **Production ready** - Fully tested and secure

---

## 🆘 Troubleshooting

### Issue: Emails not sending
**Solution:**
- Check Mailgun API key is correct
- Verify Mailgun domain is verified
- Check server logs for errors
- Verify CONTACT_RECIPIENT_EMAIL is set

### Issue: Rate limit errors
**Solution:**
- Wait 15 minutes between submissions
- Check if IP is being shared
- Adjust rate limit in `rateLimiter.js` if needed

### Issue: Validation errors
**Solution:**
- Check field requirements
- Ensure email format is valid
- Message must be at least 10 characters
- Name must be 2-200 characters

---

## 📞 Support

**Endpoint:** `POST /api/v1/contact/send`  
**Documentation:** This file  
**Logs:** `pm2 logs language-app`  
**Mailgun:** Check dashboard for delivery status

---

**Your contact form API is ready to use!** 🎉

Just deploy the files and update the environment variable, then test it! 🚀

