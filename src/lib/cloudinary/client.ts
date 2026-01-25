/**
 * Cloudinary client for character image storage.
 *
 * - Root folder: from CLOUDINARY_UPLOAD_PRESET (define folder "skitso" in preset) or
 *   CLOUDINARY_ROOT_FOLDER (default "skitso"). SessionIds are subfolders: root/sessionId.
 * - Upload: uses preset when set; folder = root/sessionId. Incoming transformation (512x512
 *   fill crop, q_auto, webp) applied before storing; we return secure_url as-is. No transform on get.
 * - Delete: by prefix root/sessionId/ when session/room is closed (expiry or explicit close).
 *
 * All operations are server-side. No Cloudinary config is exposed to the client.
 */

import { v2 as cloudinary } from 'cloudinary';

/** Root folder (e.g. skitso). Match your preset's folder. SessionIds are subfolders. */
const DEFAULT_ROOT_FOLDER = 'skitso';

function getRootFolder(): string {
  return process.env.CLOUDINARY_ROOT_FOLDER?.trim() || DEFAULT_ROOT_FOLDER;
}

/**
 * Incoming transformation (applied at upload; stored asset only).
 * - API: Image Upload API (uploader.upload) — correct for server-side uploads.
 * - Size: 512x512 fill crop.
 * - Quality: q_auto — Cloudinary picks best compression per image; recommended over fixed (e.g. 80).
 * - Format: webp — web-optimal, smaller than PNG/JPEG; we store once, serve as-is (no transform on get).
 */
const INCOMING_TRANSFORM = {
  crop: 'fill' as const,
  width: 512,
  height: 512,
  quality: 'auto' as const,
  format: 'webp' as const,
};

function isConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function getConfig() {
  if (!isConfigured()) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'
    );
  }
  return {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  };
}

/**
 * Upload a character image to Cloudinary.
 * Root folder from preset / CLOUDINARY_ROOT_FOLDER; sessionIds are subfolders (root/sessionId).
 * Uses upload preset when set (preset defines root); we pass folder = root/sessionId.
 * Applies incoming transformation (512x512 fill, q_auto, webp) at upload; stored asset is already
 * transformed. Returns secure_url as-is — no transform on get; we do not request format on read.
 *
 * @param file - Data URL (base64) or HTTP(S) URL of the image
 * @param sessionId - Party room id (subfolder under root)
 * @param characterId - Character id (used as public_id segment)
 * @returns Cloudinary secure_url of stored 512x512 WebP image. Use as-is for img src.
 */
export async function uploadCharacterImage(
  file: string,
  sessionId: string,
  characterId: string
): Promise<string> {
  const cfg = getConfig();
  cloudinary.config(cfg);

  const root = getRootFolder();
  const folder = `${root}/${sessionId}`;
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET?.trim();
  const inputType = file.startsWith('data:') ? 'data-url' : file.startsWith('http') ? 'http-url' : 'other';

  console.log('[Cloudinary] Uploading character image (transform on upload)', {
    sessionId,
    characterId,
    rootFolder: root,
    folder,
    uploadPreset: preset || '(none)',
    inputType,
    inputLength: file.length,
  });

  const uploadOptions: Record<string, unknown> = {
    folder,
    public_id: characterId,
    overwrite: true,
    transformation: INCOMING_TRANSFORM,
  };

  if (preset) {
    uploadOptions.upload_preset = preset;
  }

  const result = await cloudinary.uploader.upload(file, uploadOptions);
  if (!result?.secure_url || !result?.public_id) {
    throw new Error('Cloudinary upload did not return secure_url or public_id');
  }

  console.log('[Cloudinary] Uploaded successfully (stored 512x512 webp)', {
    sessionId,
    characterId,
    publicId: result.public_id,
    secureUrl: result.secure_url,
  });

  return result.secure_url;
}

/**
 * Delete all character images for a session (party room).
 * Call when the room is closed (e.g. session expiry).
 *
 * Uses delete_resources_by_prefix for folder root/{sessionId}/.
 */
export async function deleteSessionImages(sessionId: string): Promise<void> {
  const cfg = getConfig();
  cloudinary.config(cfg);

  const root = getRootFolder();
  const prefix = `${root}/${sessionId}/`;

  try {
    await cloudinary.api.delete_resources_by_prefix(prefix, {
      resource_type: 'image',
    });
  } catch (e) {
    if (e && typeof e === 'object' && 'error' in e) {
      const err = e as { error?: { message?: string } };
      if (err.error?.message?.includes('No assets found')) {
        return;
      }
    }
    throw e;
  }
}

export { isConfigured as isCloudinaryConfigured };

/**
 * Rewrite a Cloudinary delivery URL to request a specific format (e.g. PNG for downloads).
 * Use when you store WebP but need a widely compatible format for download.
 * Returns null if the URL is not a Cloudinary res.cloudinary.com URL.
 */
export function toCloudinaryFormatUrl(
  url: string,
  format: 'png' | 'jpg'
): string | null {
  if (!url || !url.includes('res.cloudinary.com')) return null;
  const match = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/);
  if (!match) return null;
  const prefix = match[1];
  const rest = match[2];
  const transform = format === 'png' ? 'f_png' : 'f_jpg';
  return `${prefix}${transform}/${rest}`;
}
