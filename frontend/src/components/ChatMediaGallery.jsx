import React from 'react';
import SafeImage from './SafeImage';
import { getMediaUrl } from '../api';

export const parseMessageMediaUrls = (mediaUrl) => {
  if (!mediaUrl) return [];
  if (Array.isArray(mediaUrl)) return mediaUrl;
  
  if (typeof mediaUrl === 'string') {
    const trimmed = mediaUrl.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch {}
    }
    if (trimmed.includes(',')) {
      return trimmed.split(',').map(u => u.trim()).filter(Boolean);
    }
    return [trimmed];
  }
  return [];
};

export default function ChatMediaGallery({ mediaUrl, alt = 'Shared photo', onImageClick = null }) {
  const urls = parseMessageMediaUrls(mediaUrl);

  if (!urls || urls.length === 0) return null;

  const handleClick = (e, url) => {
    e.stopPropagation();
    if (onImageClick) {
      onImageClick(url);
    } else {
      window.open(getMediaUrl(url), '_blank');
    }
  };

  // 1 Image
  if (urls.length === 1) {
    return (
      <div className="rounded-xl overflow-hidden cursor-pointer hover:opacity-95 transition-opacity">
        <SafeImage
          src={urls[0]}
          alt={alt}
          fallbackType="product"
          className="max-h-64 sm:max-h-72 w-full object-cover rounded-xl"
          onClick={(e) => handleClick(e, urls[0])}
        />
      </div>
    );
  }

  // 2 Images: 2 columns
  if (urls.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-1.5 rounded-xl overflow-hidden">
        {urls.map((url, idx) => (
          <div
            key={idx}
            className="aspect-square bg-slate-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
            onClick={(e) => handleClick(e, url)}
          >
            <SafeImage
              src={url}
              alt={`${alt} ${idx + 1}`}
              fallbackType="product"
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    );
  }

  // 3 Images: 1 large, 2 smaller
  if (urls.length === 3) {
    return (
      <div className="grid grid-cols-2 gap-1.5 rounded-xl overflow-hidden">
        <div
          className="row-span-2 aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
          onClick={(e) => handleClick(e, urls[0])}
        >
          <SafeImage
            src={urls[0]}
            alt={`${alt} 1`}
            fallbackType="product"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          {urls.slice(1).map((url, idx) => (
            <div
              key={idx}
              className="aspect-square bg-slate-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
              onClick={(e) => handleClick(e, url)}
            >
              <SafeImage
                src={url}
                alt={`${alt} ${idx + 2}`}
                fallbackType="product"
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4+ Images: 2x2 Grid with counter on 4th image
  const displayUrls = urls.slice(0, 4);
  const remainingCount = urls.length - 4;

  return (
    <div className="grid grid-cols-2 gap-1.5 rounded-xl overflow-hidden">
      {displayUrls.map((url, idx) => {
        const isLast = idx === 3 && remainingCount > 0;
        return (
          <div
            key={idx}
            className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
            onClick={(e) => handleClick(e, url)}
          >
            <SafeImage
              src={url}
              alt={`${alt} ${idx + 1}`}
              fallbackType="product"
              className="w-full h-full object-cover"
            />
            {isLast && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-base sm:text-lg backdrop-blur-[1px]">
                +{remainingCount}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
