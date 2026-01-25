/**
 * Image Download Proxy Route
 *
 * Proxies image downloads to avoid CORS issues when downloading external images.
 * Fetches the image server-side and returns it with proper headers for download.
 *
 * For Cloudinary URLs (stored as WebP), we request a PNG variant so the download
 * is a widely compatible format and matches the .png filename used by the UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { toCloudinaryFormatUrl } from '@/src/lib/cloudinary/client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const imageUrl = searchParams.get('url');
    const filename = searchParams.get('filename') || 'image.png';

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(imageUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid image URL' },
        { status: 400 }
      );
    }

    // For Cloudinary: request PNG so download matches .png filename and is widely compatible
    const fetchUrl =
      toCloudinaryFormatUrl(imageUrl, 'png') ?? imageUrl;
    const isCloudinaryPng = fetchUrl !== imageUrl;

    const imageResponse = await fetch(fetchUrl);

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: imageResponse.status }
      );
    }

    const imageBlob = await imageResponse.blob();
    const contentType = isCloudinaryPng ? 'image/png' : (imageBlob.type || 'image/png');

    return new NextResponse(imageBlob, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': imageBlob.size.toString(),
      },
    });
  } catch (error) {
    console.error('Image download proxy error:', error);
    return NextResponse.json(
      {
        error: 'Failed to download image',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
