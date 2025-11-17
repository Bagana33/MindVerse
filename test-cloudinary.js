// Test Cloudinary Upload Script
require('dotenv').config({ path: '.env.local' });
const { v2: cloudinary } = require('cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function testUpload() {
  console.log('🔍 Testing Cloudinary connection...\n');
  
  console.log('Configuration:');
  console.log('  Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
  console.log('  API Key:', process.env.CLOUDINARY_API_KEY?.slice(0, 10) + '...');
  console.log('  API Secret:', process.env.CLOUDINARY_API_SECRET ? '✓ Set' : '✗ Missing');
  console.log('');

  try {
    // Test 1: Create a simple test image (1x1 pixel base64)
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    console.log('📤 Uploading test image to neoncanvas/posts...');
    const postResult = await cloudinary.uploader.upload(testImageBase64, {
      folder: 'neoncanvas/posts',
      public_id: 'test-post-' + Date.now(),
      resource_type: 'image',
    });
    
    console.log('✅ Post folder upload successful!');
    console.log('  URL:', postResult.secure_url);
    console.log('  Folder:', postResult.folder);
    console.log('');

    // Test 2: Upload to avatars folder
    console.log('📤 Uploading test image to neoncanvas/avatars...');
    const avatarResult = await cloudinary.uploader.upload(testImageBase64, {
      folder: 'neoncanvas/avatars',
      public_id: 'test-avatar-' + Date.now(),
      resource_type: 'image',
    });
    
    console.log('✅ Avatar folder upload successful!');
    console.log('  URL:', avatarResult.secure_url);
    console.log('  Folder:', avatarResult.folder);
    console.log('');

    // Test 3: List folders
    console.log('📂 Checking folders in Cloudinary...');
    const folders = await cloudinary.api.root_folders();
    console.log('Root folders:', folders.folders.map(f => f.name).join(', '));
    console.log('');

    // Try to get neoncanvas subfolders
    try {
      const subfolders = await cloudinary.api.sub_folders('neoncanvas');
      console.log('Subfolders in neoncanvas:', subfolders.folders.map(f => f.name).join(', '));
    } catch (e) {
      console.log('Note: Cannot list subfolders (might need admin API enabled)');
    }
    console.log('');

    console.log('🎉 Success! Folders created:');
    console.log('  📁 neoncanvas/posts');
    console.log('  📁 neoncanvas/avatars');
    console.log('');
    console.log('🌐 View in Cloudinary Dashboard:');
    console.log(`  https://console.cloudinary.com/console/c-${process.env.CLOUDINARY_CLOUD_NAME}/media_library/folders/home`);
    console.log('');
    console.log('⚠️  Note: You can now delete these test images from Cloudinary Media Library');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.http_code) {
      console.error('HTTP Code:', error.http_code);
    }
    if (error.error) {
      console.error('Details:', error.error);
    }
    process.exit(1);
  }
}

testUpload();
