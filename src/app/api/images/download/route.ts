/**
 * Image Download Proxy Route
 * 
 * Proxies image downloads to avoid CORS issues when downloading external images.
 * Fetches the image server-side and returns it with proper headers for download.
 */

import { NextRequest, NextResponse } from 'next/server';

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

    // Fetch the image
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: imageResponse.status }
      );
    }

    // Get the image blob
    const imageBlob = await imageResponse.blob();

    // Return the image with download headers
    return new NextResponse(imageBlob, {
      headers: {
        'Content-Type': imageBlob.type || 'image/png',
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
