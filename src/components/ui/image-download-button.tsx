/**
 * Image Download Button
 * 
 * Hoverable download button for images that appears on hover.
 */

'use client';

interface ImageDownloadButtonProps {
  imageUrl: string;
  filename: string;
  className?: string;
}

/**
 * Image Download Button Component
 * 
 * Appears on hover and allows downloading the image.
 * Uses a proxy endpoint to avoid CORS issues.
 */
export function ImageDownloadButton({ imageUrl, filename, className = '' }: ImageDownloadButtonProps) {
  const handleDownload = async () => {
    try {
      // Use proxy endpoint to avoid CORS issues
      const proxyUrl = `/api/images/download?url=${encodeURIComponent(imageUrl)}&filename=${encodeURIComponent(filename)}`;
      
      // Fetch through proxy
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error('Failed to download image');
      }
      
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
      // Fallback: open image in new tab for manual download
      window.open(imageUrl, '_blank');
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      className={`absolute top-2 right-2 p-2 rounded-full bg-black bg-opacity-60 hover:bg-opacity-80 text-white transition-opacity duration-200 z-10 opacity-0 group-hover:opacity-100 pointer-events-auto cursor-pointer ${className}`}
      style={{
        backdropFilter: 'blur(4px)',
      }}
      aria-label={`Download ${filename}`}
      title={`Download ${filename}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>
    </button>
  );
}
