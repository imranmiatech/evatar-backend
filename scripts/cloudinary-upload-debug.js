"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
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
const signature = (0, crypto_1.createHash)('sha1')
    .update(`timestamp=${timestamp}${config.apiSecret}`)
    .digest('hex');
const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64');
async function run() {
    const form = new FormData();
    form.set('file', new Blob([onePixelPng], { type: 'image/png' }), 'pixel.png');
    form.set('api_key', config.apiKey);
    form.set('timestamp', timestamp);
    form.set('signature', signature);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
        method: 'POST',
        body: form,
    });
    console.log('HTTP status:', response.status, response.statusText);
    console.log('Content-Type:', response.headers.get('content-type'));
    console.log(await response.text());
}
void run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=cloudinary-upload-debug.js.map