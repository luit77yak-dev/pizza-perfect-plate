type StorefrontTickerProps = {
  organizationName: string;
  statusLabel: string;
};

export function StorefrontTicker({ organizationName, statusLabel }: StorefrontTickerProps) {
  const items = [organizationName, "Pizza artesanal", statusLabel, "Delivery e retirada", "Peça online"];

  return (
    <div className="ppp-top-ticker overflow-hidden bg-secondary text-secondary-foreground" aria-hidden="true">
      <div className="ppp-ticker-run flex min-w-max items-center gap-8 py-2 font-display text-[11px] uppercase tracking-[.16em] text-white">
        {items.map((item, index) => (
          <span key={index} className="inline-flex items-center gap-8">
            {item}
            <span className="text-primary">✦</span>
          </span>
        ))}
        {items.map((item, index) => (
          <span key={`repeat-${index}`} className="inline-flex items-center gap-8">
            {item}
            <span className="text-primary">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
