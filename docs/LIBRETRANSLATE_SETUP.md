# LibreTranslate Setup Guide

## ✅ Recommended: FREE Public Instance

**Perfect for BananaTalk!** No setup required.

### Configuration

The backend is already configured to use the free public instance:

```env
LIBRETRANSLATE_URL=https://libretranslate.com
LIBRETRANSLATE_API_KEY=  # Leave empty - not needed for public instance
```

### Features

- ✅ **FREE** - $0 cost
- ✅ **No API key needed** - Works out of the box
- ✅ **Rate limited** - But reasonable for small-medium apps
- ✅ **Perfect for starting out** - Ideal for BananaTalk

### That's it!

No additional setup needed. The translation service will work immediately.

---

## Optional: Paid/Unlimited Instance

If you need unlimited usage or higher rate limits:

### 1. Get API Key

1. Visit: https://portal.libretranslate.com
2. Sign up for an account
3. Get your API key from the dashboard

### 2. Update Environment

```env
LIBRETRANSLATE_URL=https://libretranslate.com  # or your custom instance
LIBRETRANSLATE_API_KEY=your_api_key_here
```

### 3. Restart Server

```bash
pm2 restart language-app
# or
npm run dev
```

---

## Alternative: Host Your Own Instance

For complete control and unlimited usage:

1. Set up your own LibreTranslate server
2. Update `.env`:
   ```env
   LIBRETRANSLATE_URL=https://your-instance.com
   LIBRETRANSLATE_API_KEY=  # Leave empty if your instance doesn't require it
   ```

---

## Fixed Issues

✅ **Comment translation route parameter** - Fixed `undefined` commentId error  
✅ **LibreTranslate configuration** - Works with free public instance (no API key needed)

---

## Summary

**For BananaTalk: Use the FREE public instance - no API key needed!**

The backend is already configured correctly. Just restart your server and it will work.

