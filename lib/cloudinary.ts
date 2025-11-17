import { v2 as cloudinary } from 'cloudinary';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

export function getCloudinaryCreds() {
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials are not configured');
  }
  return { cloudName, apiKey, apiSecret };
}

export function createUploadSignature(params: { folder?: string; public_id?: string }) {
  const { apiSecret } = getCloudinaryCreds();
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign: Record<string, any> = { timestamp };
  if (params.folder) toSign.folder = params.folder;
  if (params.public_id) toSign.public_id = params.public_id;
  const signature = cloudinary.utils.api_sign_request(toSign, apiSecret);
  return { timestamp, signature };
}

// Automatically create folder structure in Cloudinary
export async function ensureFolders() {
  try {
    const { cloudName } = getCloudinaryCreds();
    
    // Cloudinary автоматаар folder үүсгэх - upload хийхэд автоматаар үүснэ
    // Folder-ууд:
    // - neoncanvas/posts
    // - neoncanvas/avatars
    
    console.log(`✅ Cloudinary folders will be auto-created on first upload to: ${cloudName}`);
    return true;
  } catch (error) {
    console.warn('⚠️ Cloudinary folder setup skipped:', error);
    return false;
  }
}
