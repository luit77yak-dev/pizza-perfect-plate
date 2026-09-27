import { ImageAccordion } from "@/components/ui/image-accordion";
import type { Category, Product } from "@/lib/domain/types";

type MenuImageAccordionProps = {
  categories: Category[];
  products: Product[];
};

export function MenuImageAccordion({ categories, products }: MenuImageAccordionProps) {
  return (
    <div className="ppp-reference-category-accordion mb-8">
      <ImageAccordion
        items={[
          ...categories
            .filter((category) => Boolean(category.image_url))
            .slice(0, 6)
            .map((category) => ({ image: category.image_url!, title: category.name, subtitle: "Confira os sabores" })),
          ...products
            .filter((product) => Boolean(product.image_url))
            .slice(0, 6)
            .map((product) => ({ image: product.image_url!, title: product.name, subtitle: "Feito na hora" })),
        ]}
        className="h-[330px] sm:h-[410px] lg:h-[460px]"
      />
    </div>
  );
}
