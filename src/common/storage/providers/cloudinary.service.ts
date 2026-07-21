import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    v2 as cloudinary,
    UploadApiResponse,
    UploadApiErrorResponse,
} from 'cloudinary';
import { StorageService } from '../storage.service';
import { PassThrough } from 'stream';

@Injectable()
export class CloudinaryService implements StorageService {
    constructor(private configService: ConfigService) {
        cloudinary.config({
            cloud_name: this.configService.get<string>('CLOUD_NAME'),
            api_key: this.configService.get<string>('CLOUD_API_KEY'),
            api_secret: this.configService.get<string>('CLOUD_API_SECRET'),
        });
    }

    async uploadFile(
        file: Express.Multer.File,
        folder: string = 'general',
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!file || !file.buffer) {
                return reject(
                    new InternalServerErrorException('File is empty or missing buffer'),
                );
            }

            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: folder,
                    resource_type: 'auto',
                    timeout: 120000,
                },
                (error: UploadApiErrorResponse, result: UploadApiResponse) => {
                    if (error) {
                        console.error('Cloudinary Upload Error:', error);
                        return reject(
                            new InternalServerErrorException(
                                'Failed to upload file to Cloudinary',
                            ),
                        );
                    }
                    if (!result) {
                        return reject(
                            new InternalServerErrorException(
                                'Failed to get upload result from Cloudinary',
                            ),
                        );
                    }
                    resolve(result.secure_url);
                },
            );

            // Directly end the upload stream with the buffer
            uploadStream.end(file.buffer);
        });
    }

    async deleteFile(fileUrl: string): Promise<void> {
        try {
            // Extract public_id from Cloudinary URL
            const urlParts = fileUrl.split('/');
            const uploadIndex = urlParts.indexOf('upload');

            if (uploadIndex !== -1) {
                // Extract folder and filename
                const pathParts = urlParts.slice(uploadIndex + 2);
                const filenameWithExt = pathParts.pop();

                if (filenameWithExt) {
                    const filename = filenameWithExt.split('.').slice(0, -1).join('.');
                    const folderPath = pathParts.join('/');
                    const publicId = folderPath ? `${folderPath}/${filename}` : filename;

                    if (publicId) {
                        // Destroy file from Cloudinary
                        await cloudinary.uploader.destroy(publicId);
                    }
                }
            }
        } catch (error) {
            console.error('Cloudinary Delete Error:', error);
        }
    }
}
