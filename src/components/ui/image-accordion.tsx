import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type AccordionItem = {
  image: string;
  title: string;
  subtitle?: string;
};

/** Editorial photo accordion that automatically cycles through its panels. */
export function ImageAccordion({
  items,
  className,
}: {
  items: AccordionItem[];
  className?: string;
}) {
  const usableItems = items.filter((item) => Boolean(item.image)).slice(0, 6);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (usableItems.length < 2) return;

    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % usableItems.length);
    }, 2600);

    return () => window.clearInterval(timer);
  }, [usableItems.length]);

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
            onClick={() => setActive(index)}
            onMouseEnter={() => setActive(index)}
            className={cn(
              "relative min-w-0 overflow-hidden rounded-[1.35rem] border border-white/20 bg-black/20 text-left",
              "transition-[flex-grow,filter] duration-700 ease-[cubic-bezier(.22,1,.36,1)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
            )}
            style={{
              flexGrow: isActive ? 5 : 1,
              flexBasis: 0,
            }}
          >
            <img
              src={item.image}
              alt={item.title}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-transform duration-1000 ease-out",
                isActive ? "scale-100" : "scale-110",
              )}
              style={{
                filter: isActive
                  ? "brightness(.92) saturate(1)"
                  : "brightness(.48) saturate(.58)",
              }}
              loading={index < 2 ? "eager" : "lazy"}
            />

            <div
              className="absolute inset-0 transition-opacity duration-700"
              style={{
                background: isActive
                  ? "linear-gradient(to top, rgba(0,0,0,.82), rgba(0,0,0,.08) 62%, transparent)"
                  : "rgba(0,0,0,.22)",
              }}
            />

            <span
              className={cn(
                "absolute left-3 top-3 rounded-full border border-white/30 bg-black/30 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[.16em] text-white/90 backdrop-blur-md",
                "transition-opacity duration-500",
                isActive ? "opacity-100" : "opacity-70",
              )}
            >
              {String(index + 1).padStart(2, "0")}
            </span>

            <span
              className={cn(
                "absolute inset-x-5 bottom-5 transition-all duration-500",
                isActive
                  ? "translate-y-0 opacity-100"
                  : "translate-y-3 opacity-0",
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
