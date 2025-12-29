# LibreTranslate API Key Setup - REQUIRED

## ⚠️ Important Update

The public LibreTranslate instance (`https://libretranslate.com`) now **requires an API key** for all requests.

## Quick Setup (5 minutes)

### Step 1: Get Free API Key

1. Visit: **https://portal.libretranslate.com**
2. Sign up for a free account (takes 2 minutes)
3. Go to your dashboard
4. Copy your API key

### Step 2: Add to Environment

Add the API key to your `.env` file on your server:

```bash
# SSH into your server
ssh your-server

# Edit the config file
nano /home/language_exchange_backend_application/config/config.env

# Add this line:
LIBRETRANSLATE_API_KEY=your_api_key_here

# Save and exit (Ctrl+X, then Y, then Enter)
```

### Step 3: Restart Server

```bash
pm2 restart language-app
```

### Step 4: Verify

Check the logs to make sure it's working:

```bash
pm2 logs language-app --lines 20
```

---

## Alternative: Use Different LibreTranslate Instance

If you prefer not to use the portal, you can:

1. **Host your own instance** (unlimited, free, but requires setup)
2. **Use a different public instance** (if available)

Update your `.env`:
```env
LIBRETRANSLATE_URL=https://your-instance.com
LIBRETRANSLATE_API_KEY=  # Leave empty if instance doesn't require it
```

---

## Why API Key is Needed

The public LibreTranslate instance implemented API keys to:
- Prevent abuse
- Manage rate limits
- Provide better service

**Good news:** The free tier is very generous and should be more than enough for BananaTalk!

---

## Cost

**FREE** - The API key from portal.libretranslate.com is free and provides generous usage limits.

---

## Troubleshooting

### Error: "LibreTranslate API key required"

1. Make sure you added `LIBRETRANSLATE_API_KEY` to your `.env` file
2. Make sure you restarted the server after adding it
3. Check that there are no typos in the API key
4. Verify the API key is active in your portal dashboard

### Error: "Invalid API key"

1. Check that the API key is correct
2. Make sure there are no extra spaces in the `.env` file
3. Regenerate the API key in the portal if needed

### Still having issues?

1. Check server logs: `pm2 logs language-app`
2. Verify environment variable is loaded: Check if `process.env.LIBRETRANSLATE_API_KEY` exists
3. Test the API key directly with curl:
   ```bash
   curl -X POST https://libretranslate.com/translate \
     -H "Content-Type: application/json" \
     -d '{"q":"Hello","source":"en","target":"es","api_key":"YOUR_API_KEY"}'
   ```

---

## Summary

✅ Get free API key from https://portal.libretranslate.com  
✅ Add to `.env`: `LIBRETRANSLATE_API_KEY=your_key`  
✅ Restart server: `pm2 restart language-app`  
✅ Done! Translations will work now.

