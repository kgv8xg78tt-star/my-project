import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  urls: string[];
  altBase: string;
};

export default function RenderCarousel({ urls, altBase }: Props) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const n = urls.length;
  const safeIndex = n === 0 ? 0 : Math.min(index, n - 1);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (n <= 1) return;
      setIndex((i) => (i + dir + n) % n);
    },
    [n],
  );

  useEffect(() => {
    if (index !== safeIndex) setIndex(safeIndex);
  }, [index, safeIndex]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    const el = trackRef.current;
    if (!el || n <= 1) return;
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [go, n]);

  if (n === 0) {
    return <div className="render-carousel render-carousel--empty">Нет изображений визуализации</div>;
  }

  return (
    <div className="render-carousel">
      <div
        ref={trackRef}
        className="render-carousel__viewport"
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Визуализация проекта"
        onTouchStart={(e) => {
          touchStartX.current = e.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          if (start == null || n <= 1) return;
          const end = e.changedTouches[0]?.clientX ?? start;
          const dx = end - start;
          if (dx > 56) go(-1);
          else if (dx < -56) go(1);
        }}
      >
        <div
          className="render-carousel__track"
          style={{ transform: `translateX(-${safeIndex * 100}%)` }}
        >
          {urls.map((url, i) => (
            <div key={url + i} className="render-carousel__slide">
              <img src={url} alt={`${altBase} — рендер ${i + 1}`} className="render-carousel__img" />
            </div>
          ))}
        </div>

        {n > 1 ? (
          <>
            <button
              type="button"
              className="render-carousel__nav render-carousel__nav--prev"
              aria-label="Предыдущий слайд"
              onClick={() => go(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="render-carousel__nav render-carousel__nav--next"
              aria-label="Следующий слайд"
              onClick={() => go(1)}
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      {n > 1 ? (
        <div className="render-carousel__dots" role="tablist" aria-label="Слайды">
          {urls.map((url, i) => (
            <button
              key={url + i}
              type="button"
              role="tab"
              aria-selected={i === safeIndex}
              className={"render-carousel__dot" + (i === safeIndex ? " is-active" : "")}
              onClick={() => setIndex(i)}
              aria-label={`Слайд ${i + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
