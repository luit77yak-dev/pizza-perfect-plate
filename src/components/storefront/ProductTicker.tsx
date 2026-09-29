import type { Product } from "@/lib/domain/types";

type ProductTickerProps = {
  products: Product[];
};

const steps = ["Preparo", "Forno", "À mesa"];

export function ProductTicker({ products }: ProductTickerProps) {
  const images = products.filter((product) => Boolean(product.image_url)).slice(0, 3);

  if (images.length === 0) return null;

  return (
    <section className="ppp-process-strip" aria-label="Nossa forma de fazer">
      <div className="ppp-process-grid">
        {images.map((product, index) => (
          <figure key={product.id} className="ppp-process-card">
            <img
              src={product.image_url!}
              alt={steps[index] + " da experiência da loja"}
              loading="lazy"
            />
            <figcaption>
              <span>{steps[index]}</span>
              <strong>{product.name}</strong>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
