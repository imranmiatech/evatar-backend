import { Express } from 'express';

export abstract class StorageService {
    // Upload a file
    abstract uploadFile(
        file: Express.Multer.File,
        folder?: string,
    ): Promise<string>;

    // Delete a file
    abstract deleteFile(fileUrl: string): Promise<void>;
}
