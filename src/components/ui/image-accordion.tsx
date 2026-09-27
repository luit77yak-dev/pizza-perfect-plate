import { useState } from "react";
import { cn } from "@/lib/utils";

type AccordionItem = {
  image: string;
  title: string;
  subtitle?: string;
};

/** Editorial photo accordion: one panel expands while the others become narrow strips. */
export function ImageAccordion({
  items,
  className,
}: {
  items: AccordionItem[];
  className?: string;
}) {
  const usableItems = items.filter((item) => Boolean(item.image)).slice(0, 6);
  const [active, setActive] = useState(0);

  if (!usableItems.length) return null;

  return (
    <div
      className={cn(
        "flex h-full min-h-[260px] w-full gap-2 overflow-hidden",
        className,
      )}
    >
      {usableItems.map((item, index) => {
        const isActive = active === index;

        return (
          <button
            key={item.title + index}
            type="button"
            aria-label={`Ver ${item.title}`}
            aria-pressed={isActive}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onClick={() => setActive(index)}
            className={cn(
              "relative min-w-0 overflow-hidden rounded-[1.35rem] border border-white/20 bg-black/20 text-left",
              "transition-[flex-grow,filter] duration-500 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
            )}
            style={{
              flexGrow: isActive ? 6 : 1,
              flexBasis: 0,
            }}
          >
            <img
              src={item.image}
              alt={item.title}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out",
                isActive ? "scale-100" : "scale-110",
              )}
              style={{
                filter: isActive ? "brightness(.9) saturate(1)" : "brightness(.58) saturate(.65)",
              }}
              loading={index === 0 ? "eager" : "lazy"}
            />

            <div
              className="absolute inset-0"
              style={{
                background: isActive
                  ? "linear-gradient(to top, rgba(0,0,0,.78), rgba(0,0,0,.08) 62%, transparent)"
                  : "rgba(0,0,0,.18)",
              }}
            />

            <span className="absolute left-3 top-3 rounded-full border border-white/30 bg-black/30 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[.16em] text-white/90 backdrop-blur-md">
              {String(index + 1).padStart(2, "0")}
            </span>

            <span
              className={cn(
                "absolute inset-x-5 bottom-5 transition-all duration-300",
                isActive ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
              )}
            >
              <span className="block text-lg font-semibold tracking-tight text-white drop-shadow-md sm:text-2xl">
                {item.title}
              </span>
              {item.subtitle ? (
                <span className="mt-1 block text-sm text-white/75">
                  {item.subtitle}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
