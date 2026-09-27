import { useState } from "react";
import { cn } from "@/lib/utils";

/** Photo strips that widen when hovered or tapped, revealing their caption. */
export function ImageAccordion({ items, className }: { items: { image: string; title: string; subtitle?: string }[]; className?: string }) {
  const [active, setActive] = useState(0);
  return (
    <div className={cn("flex h-[420px] w-full gap-3", className)}>
      {items.map((item, i) => (
        <button
          key={item.title}
          type="button"
          onMouseEnter={() => setActive(i)}
          onFocus={() => setActive(i)}
          onClick={() => setActive(i)}
          className={cn("relative min-w-0 overflow-hidden rounded-3xl transition-[flex-grow] duration-700 ease-[cubic-bezier(.22,1,.36,1)]", active === i ? "grow-[5]" : "grow")}
          style={{ flexBasis: 0 }}
        >
          <img src={item.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className={cn("absolute bottom-5 left-5 right-5 text-left text-white transition-all duration-500", active === i ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}>
            <div className="text-lg font-semibold">{item.title}</div>
            {item.subtitle && <div className="text-sm text-white/75">{item.subtitle}</div>}
          </div>
        </button>
      ))}
    </div>
  );
}
