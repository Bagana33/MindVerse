"use client";

import { useState } from "react";

type PostImageProps = {
  src: string;
  alt: string;
  className?: string;
  rounded?: string;
  priority?: boolean;
  sizes?: string;
};

// Resize public Cloudinary uploads at the CDN. Leave signed/private and other
// providers untouched, and always retain the original for the full-size viewer.
export function getPostImageSources(src: string) {
  try {
    const url = new URL(src);
    const marker = "/image/upload/";
    if (
      url.protocol !== "https:" ||
      url.hostname !== "res.cloudinary.com" ||
      !url.pathname.includes(marker) ||
      url.pathname.includes("/s--") ||
      url.search
    ) return { src, srcSet: undefined };

    const resize = (width: number) => src.replace(marker, `${marker}f_auto,q_auto,c_limit,w_${width}/`);
    return {
      src: resize(960),
      srcSet: [480, 768, 960, 1440].map((width) => `${resize(width)} ${width}w`).join(", "),
    };
  } catch {
    return { src, srcSet: undefined };
  }
}

function ImageContent({ src, alt, priority = false, sizes }: Pick<PostImageProps, "src" | "alt" | "priority" | "sizes">) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [original, setOriginal] = useState(false);
  const sources = original ? { src, srcSet: undefined } : getPostImageSources(src);

  return (
    <>
      {status === "loading" && (
        <div aria-hidden="true" className="absolute inset-0 bg-nc-panel/60 motion-safe:animate-pulse" />
      )}
      {status === "error" ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-nc-muted" role="status">
          <span className="material-symbols-outlined text-3xl" aria-hidden="true">broken_image</span>
          Зургийг ачаалж чадсангүй.
        </span>
      ) : (
        <img
          src={sources.src}
          srcSet={sources.srcSet}
          sizes={sizes || "(max-width: 767px) calc(100vw - 32px), (max-width: 1279px) 700px, 760px"}
          alt={alt}
          width={1200}
          height={900}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onLoad={() => setStatus("loaded")}
          onError={() => {
            if (!original && sources.src !== src) setOriginal(true);
            else setStatus("error");
          }}
          className={`block h-full w-full object-contain motion-safe:transition-opacity ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </>
  );
}

export function PostImage({ src, alt, className = "", rounded = "rounded-2xl", priority = false, sizes }: PostImageProps) {
  return (
    <div className={`relative aspect-[4/3] w-full overflow-hidden bg-nc-panel ${rounded} ${className}`}>
      <ImageContent key={src} src={src} alt={alt} priority={priority} sizes={sizes} />
    </div>
  );
}

export default PostImage;
