import { createHash } from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const cloudName = process.env.CLOUD_NAME?.replace(/"/g, '');
const apiKey = process.env.CLOUD_API_KEY?.replace(/"/g, '');
const apiSecret = process.env.CLOUD_API_SECRET?.replace(/"/g, '');

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error('Missing CLOUD_NAME, CLOUD_API_KEY, or CLOUD_API_SECRET');
}

const config = {
  cloudName,
  apiKey,
  apiSecret,
};

const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = createHash('sha1')
  .update(`timestamp=${timestamp}${config.apiSecret}`)
  .digest('hex');

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

async function run() {
  const form = new FormData();
  form.set('file', new Blob([onePixelPng], { type: 'image/png' }), 'pixel.png');
  form.set('api_key', config.apiKey);
  form.set('timestamp', timestamp);
  form.set('signature', signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    {
      method: 'POST',
      body: form,
    },
  );

  console.log('HTTP status:', response.status, response.statusText);
  console.log('Content-Type:', response.headers.get('content-type'));
  console.log(await response.text());
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
