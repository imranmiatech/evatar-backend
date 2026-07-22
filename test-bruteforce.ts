import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

async function run() {
  try {
    await cloudinary.api.ping();
    console.log('Cloudinary credentials are valid.');
  } catch (error) {
    console.error('Cloudinary credential check failed:', error);
    process.exitCode = 1;
  }
}

void run();
