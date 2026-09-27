import { useState } from "react";
import { cn } from "@/lib/utils";

type AccordionItem = {
  image: string;
  title: string;
  subtitle?: string;
};

/**
 * Editorial image accordion: narrow photo strips expand into the active panel.
 * Desktop: hover/focus expands a strip.
 * Touch: tapping a strip keeps it expanded.
 */
export function ImageAccordion({
  items,
  className,
}: {
  items: AccordionItem[];
  className?: string;
}) {
  const usableItems = items.filter((item) => Boolean(item.image)).slice(0, 5);
  const [active, setActive] = useState(0);

  if (!usableItems.length) return null;

  return (
    <div
      className={cn(
        "group/accordion flex h-full min-h-[300px] w-full gap-1.5 overflow-hidden rounded-[1rem]",
        className,
      )}
      onMouseLeave={() => setActive(0)}
    >
      {usableItems.map((item, index) => (
        <button
          key={item.title + index}
          type="button"
          aria-label={`Ver ${item.title}`}
          aria-pressed={active === index}
          onMouseEnter={() => setActive(index)}
          onFocus={() => setActive(index)}
          onClick={() => setActive(index)}
          className={cn(
            "relative min-w-0 overflow-hidden border border-white/15 bg-black/20 text-left transition-[flex-grow,filter,transform] duration-700 ease-[cubic-bezier(.22,1,.36,1)]",
            "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
            active === index
              ? "grow-[7] saturate-100"
              : "grow-[1] saturate-[.68] hover:saturate-90",
          )}
          style={{ flexBasis: 0 }}
        >
          <img
            src={item.image}
            alt={item.title}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-[transform,filter] duration-1000 ease-out",
              active === index ? "scale-100" : "scale-110",
            )}
            loading={index === 0 ? "eager" : "lazy"}
          />

          <div
            className={cn(
              "absolute inset-0 transition-opacity duration-500",
              active === index
                ? "bg-gradient-to-t from-black/80 via-black/15 to-transparent opacity-100"
                : "bg-black/25 opacity-100",
            )}
          />

          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/30 bg-black/30 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[.16em] text-white/90 backdrop-blur-md">
            <span className="size-1.5 rounded-full bg-white/80" />
            {String(index + 1).padStart(2, "0")}
          </div>

          <div
            className={cn(
              "absolute inset-x-4 bottom-4 transition-all duration-500 sm:inset-x-5 sm:bottom-5",
              active === index
                ? "translate-y-0 opacity-100"
                : "translate-y-2 opacity-0",
            )}
          >
            <p className="text-lg font-semibold tracking-tight text-white drop-shadow-md sm:text-xl">
              {item.title}
            </p>
            {item.subtitle ? (
              <p className="mt-0.5 text-xs text-white/75 sm:text-sm">
                {item.subtitle}
              </p>
            ) : null}
          </div>
        </button>
      ))}
    </div>
  );
}
