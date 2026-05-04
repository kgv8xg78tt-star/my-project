import { useEffect } from "react";

type Props = {
  open: boolean;
  src: string | null;
  alt: string;
  onClose: () => void;
};

export default function ImageLightbox({ open, src, alt, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !src) return null;

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Просмотр планировки">
      <button type="button" className="lightbox__backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="lightbox__panel">
        <button type="button" className="lightbox__close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <img src={src} alt={alt} className="lightbox__img" />
      </div>
    </div>
  );
}
