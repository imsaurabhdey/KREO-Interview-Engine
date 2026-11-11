/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enterprise Audio/Video Recording Storage, Cloudflare R2 Upload & Retention Cleanup Engine.
 */

import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getDb, saveDb } from './db';

export const recordingsDir = path.join(process.cwd(), 'recordings');
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

export const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, recordingsDir);
  },
  filename: (req, file, cb) => {
    const { token } = req.params;
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `${token}${ext}`);
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for 45 min compressed audio/video
  }
});

let s3ClientInstance: S3Client | null = null;

export function getS3Client(): S3Client | null {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  return s3ClientInstance;
}

/**
 * Uploads a local recording file to Cloudflare R2 if configured.
 */
export async function uploadToR2(filePath: string, fileName: string): Promise<string | null> {
  const client = getS3Client();
  if (!client) return null;

  const bucketName = process.env.CLOUDFLARE_R2_BUCKET;
  if (!bucketName) {
    console.warn('[R2-UPLOAD] S3 Client is ready, but CLOUDFLARE_R2_BUCKET is not set.');
    return null;
  }

  try {
    const fileContent = fs.readFileSync(filePath);
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: fileContent,
        ContentType: 'video/webm',
      })
    );

    if (process.env.CLOUDFLARE_R2_PUBLIC_URL) {
      const publicBase = process.env.CLOUDFLARE_R2_PUBLIC_URL.endsWith('/')
        ? process.env.CLOUDFLARE_R2_PUBLIC_URL
        : `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/`;
      return `${publicBase}${fileName}`;
    }

    return `/recordings/${fileName}`;
  } catch (err) {
    console.error('[R2-UPLOAD] Cloudflare R2 Upload failed:', err);
    return null;
  }
}

/**
 * Deletes candidate recording from local disk and Cloudflare R2.
 */
export async function deleteCandidateRecording(token: string, candidateName?: string): Promise<void> {
  const fileName = `${token}.webm`;
  const localFilePath = path.join(recordingsDir, fileName);

  if (fs.existsSync(localFilePath)) {
    try {
      fs.unlinkSync(localFilePath);
      console.log(`[CLEANUP] Deleted local recording file for candidate: ${localFilePath}`);
    } catch (err) {
      console.error(`[CLEANUP] Error deleting local recording file ${localFilePath}:`, err);
    }
  }

  const s3Client = getS3Client();
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET;
  if (s3Client && bucketName) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: fileName
        })
      );
      console.log(`[R2-CLEANUP] Deleted recording for candidate ${candidateName || token} from Cloudflare R2`);
    } catch (err) {
      console.error(`[R2-CLEANUP] Error deleting recording from Cloudflare R2:`, err);
    }
  }
}

/**
 * Automatic retention cleanup of video recordings older than 30 days.
 */
export function runRecordingsCleanup() {
  console.log('[CLEANUP] Scanning for expired recordings (older than 30 days)...');
  const db = getDb();
  const now = new Date();
  let dbModified = false;

  db.candidates.forEach((candidate, index) => {
    if (!candidate.recordingUrl) return;

    const dateStr = candidate.completedAt || candidate.createdAt;
    if (!dateStr) return;

    const completedDate = new Date(dateStr);
    const diffTime = Math.abs(now.getTime() - completedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 30) {
      console.log(`[CLEANUP] Recording for candidate "${candidate.name}" (${candidate.token}) has expired (${diffDays} days old). Removing asset...`);
      
      const fileName = `${candidate.token}.webm`;
      const localFilePath = path.join(recordingsDir, fileName);
      if (fs.existsSync(localFilePath)) {
        try {
          fs.unlinkSync(localFilePath);
          console.log(`[CLEANUP] Deleted local file: ${localFilePath}`);
        } catch (e) {
          console.error(`[CLEANUP] Failed to delete local file ${localFilePath}:`, e);
        }
      }

      candidate.recordingUrl = undefined;
      db.candidates[index] = candidate;
      dbModified = true;
    }
  });

  if (dbModified) {
    saveDb(db);
  }
}
