#!/bin/bash

# Quick email send script for account restoration

echo ""
echo "📧 BanaTalk Account Restoration Email Sender"
echo "=============================================="
echo ""

if [ -z "$1" ]; then
    echo "Usage: ./send_email.sh <email>"
    echo "Example: ./send_email.sh nozil@mail.ru"
    echo ""
    exit 1
fi

EMAIL=$1

echo "Sending restoration email to: $EMAIL"
echo ""

node scripts/sendAccountRestorationEmail.js "$EMAIL"

if [ $? -eq 0 ]; then
    echo "✅ Email send command executed successfully"
    echo ""
    echo "📌 Make sure you have SendGrid or Mailgun configured:"
    echo "   - SENDGRID_API_KEY in .env"
    echo "   - OR MAILGUN_API_KEY + MAILGUN_DOMAIN"
else
    echo "❌ Failed to send email"
    echo "   Check your email configuration"
fi

echo ""
