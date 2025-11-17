# Cloudinary Setup Guide

## Current Configuration Status

✅ API Key: `524826371873985`  
✅ API Secret: `vL0vLbxEYOn5cCvHDkW3DLh6TKU`  
⚠️ Cloud Name: **NEEDED**

## How to Find Your Cloud Name

1. Go to your [Cloudinary Dashboard](https://console.cloudinary.com/)
2. Once logged in, you'll see your **Cloud name** at the top of the dashboard
3. It usually looks something like: `dpxyz1234` or `your-company-name`

## Steps to Complete Setup

1. **Find your Cloud Name** from the Cloudinary dashboard
2. **Update `.env.local`** file and replace `your_cloud_name_here` with your actual cloud name:

```bash
CLOUDINARY_CLOUD_NAME=your_actual_cloud_name
CLOUDINARY_API_KEY=524826371873985
CLOUDINARY_API_SECRET=vL0vLbxEYOn5cCvHDkW3DLh6TKU
```

3. **Restart your development server** (if running):
```bash
npm run dev
```

4. **Test the upload** by:
   - Creating a new post with an image
   - Uploading an avatar in your profile
   - Check the browser network tab to see uploads go to Cloudinary

## Verifying the Integration

Once configured, uploads will:
- ✅ Upload directly to Cloudinary CDN
- ✅ Return `secure_url` (https://res.cloudinary.com/...)
- ✅ Fall back to base64 if Cloudinary fails
- ✅ Store images in folders:
  - `neoncanvas/posts` - Post images
  - `neoncanvas/avatars` - Profile avatars

## Deployment (Vercel)

Add the same environment variables to your Vercel project:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
3. Redeploy

## Benefits

- 🚀 Faster image loading (CDN)
- 📦 Smaller database/payload sizes
- 🔄 Automatic format optimization (WebP, AVIF)
- 🖼️ On-the-fly transformations available
- 💾 Reduced bandwidth costs

## Need Help?

If you can't find your cloud name, you can also:
- Check the URL when logged into Cloudinary - it often includes your cloud name
- Look at any existing Cloudinary image URLs you may have
- Contact Cloudinary support

