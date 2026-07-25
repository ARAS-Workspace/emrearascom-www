import React, { useState, useEffect, useRef } from 'react';
import { SkeletonPlaceholder } from '@carbon/react';
import { useIsClient } from '@shared/hooks/useIsClient';
import './styles/Figure.scss';

interface FigureProps {
  src: string;
  alt: string;
  /** Optional caption rendered under the image as a <figcaption>. */
  caption?: string;
  /** Intrinsic pixel size. Both set the reserved aspect ratio (avoids layout shift). */
  width?: number;
  height?: number;
}

/**
 * Content image for MDX posts. Renders a semantic `<figure>` with an optional
 * caption, styled with Carbon design tokens.
 *
 * Loading UX mirrors the other rich content blocks (CodeHighlight, Mermaid): a
 * Carbon `SkeletonPlaceholder` holds the image's reserved space during prerender
 * and until the image finishes loading on the client, then the image fades in
 * and the skeleton is removed. Gated on `useIsClient` so prerender and the first
 * client render agree — no hydration mismatch.
 */
const Figure: React.FC<FigureProps> = ({ src, alt, caption, width, height }) => {
  const isClient = useIsClient();
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // A cached image can already be complete before onLoad would fire.
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, [isClient]);

  const aspectRatio = width && height ? `${width} / ${height}` : '16 / 9';

  return (
    <figure className="mdx-figure">
      <div className="mdx-figure__frame" style={{ aspectRatio }}>
        {(!isClient || !loaded) && (
          <SkeletonPlaceholder
            className="mdx-figure__skeleton"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
        )}
        {isClient && (
          <img
            ref={imgRef}
            className={`mdx-figure__img${loaded ? ' is-loaded' : ''}`}
            src={src}
            alt={alt}
            width={width}
            height={height}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
          />
        )}
      </div>
      {caption ? <figcaption className="mdx-figure__caption">{caption}</figcaption> : null}
    </figure>
  );
};

export default Figure;
