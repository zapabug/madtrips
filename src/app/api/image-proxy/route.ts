import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const imageUrl = searchParams.get('url')

  if (!imageUrl) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
  }

  try {
    // Basic URL validation (you might want more robust validation)
    new URL(imageUrl); 
  } catch (_) {
    return NextResponse.json({ error: 'Invalid URL parameter' }, { status: 400 })
  }

  try {
    // Fetch the image from the external source
    const imageResponse = await fetch(imageUrl, {
      headers: {
        // Optional: Forward some headers if needed, but be careful
        // 'User-Agent': request.headers.get('user-agent') || 'ImageProxy/1.0', 
      },
    });

    if (!imageResponse.ok) {
      // Forward the status code and potentially the error message from the source
      return NextResponse.json(
        { error: `Failed to fetch image: ${imageResponse.statusText}` },
        { status: imageResponse.status }
      );
    }

    // Get the content type and the image data as a readable stream
    const contentType = imageResponse.headers.get('content-type') || 'application/octet-stream';
    const imageStream = imageResponse.body;

    if (!imageStream) {
      return NextResponse.json({ error: 'Image response body is empty' }, { status: 500 });
    }

    // Create a new response, streaming the image data back
    const response = new NextResponse(imageStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Optional: Add cache headers if desired
        // 'Cache-Control': 'public, max-age=604800, immutable', 
      },
    });

    return response;

  } catch (error) {
    console.error('Image proxy error:', error);
    return NextResponse.json({ error: 'Internal Server Error fetching image' }, { status: 500 })
  }
} 