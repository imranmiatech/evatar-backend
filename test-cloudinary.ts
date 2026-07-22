import {
  v2 as cloudinary,
  UploadApiErrorResponse,
  UploadApiResponse,
} from 'cloudinary';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('CLOUD_NAME:', process.env.CLOUD_NAME);
console.log('CLOUD_API_KEY present:', Boolean(process.env.CLOUD_API_KEY));
console.log('CLOUD_API_SECRET present:', Boolean(process.env.CLOUD_API_SECRET));

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME?.replace(/"/g, ''),
  api_key: process.env.CLOUD_API_KEY?.replace(/"/g, ''),
  api_secret: process.env.CLOUD_API_SECRET?.replace(/"/g, ''),
});

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

function uploadBuffer(): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        ...(process.env.NO_FOLDER === 'true'
          ? {}
          : { folder: 'cloudinary-health-check' }),
        resource_type: 'image',
        timeout: 120000,
      },
      (
        error: UploadApiErrorResponse | undefined,
        result: UploadApiResponse | undefined,
      ) => {
        if (error) {
          reject(
            new Error(
              JSON.stringify({
                message: error.message,
                http_code: error.http_code,
                name: error.name,
              }),
            ),
          );
          return;
        }

        if (!result) {
          reject(new Error('Cloudinary did not return an upload result.'));
          return;
        }

        resolve(result);
      },
    );

    stream.end(onePixelPng);
  });
}

void uploadBuffer()
  .then((result) => {
    console.log('Success:', result.secure_url);
  })
  .catch((error: unknown) => {
    console.error('Cloudinary Error Details:', error);
    process.exitCode = 1;
  });
