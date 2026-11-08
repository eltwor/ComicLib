import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

const arrowClass =
  "absolute top-1/2 z-10 -translate-y-1/2 rounded-full border border-line bg-surface/95 px-2.5 py-1 text-xl leading-none text-body shadow-lg backdrop-blur transition-colors hover:border-accent hover:text-accent";

export function CardRow({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  const [overflow, setOverflow] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const measure = () => {
    const el = scroller.current;
    if (el) setOverflow(el.scrollWidth > el.clientWidth + 4);
  };

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [count]);

  const scroll = (dir: number) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {overflow && (
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label="Scroll left"
          className={`${arrowClass} left-0`}
        >
          ‹
        </button>
      )}

      <div
        ref={scroller}
        className="flex snap-x gap-4 overflow-x-auto scroll-smooth pb-2"
      >
        {children}
      </div>

      {overflow && (
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label="Scroll right"
          className={`${arrowClass} right-0`}
        >
          ›
        </button>
      )}
    </div>
  );
}
