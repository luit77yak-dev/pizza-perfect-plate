import { ImageAccordion } from "@/components/ui/image-accordion";
import type { Category, Product } from "@/lib/domain/types";

type MenuImageAccordionProps = {
  categories: Category[];
  products: Product[];
};

export function MenuImageAccordion({ categories, products }: MenuImageAccordionProps) {
  const categoryItems = categories
    .filter((category) => Boolean(category.image_url))
    .slice(0, 6)
    .map((category) => ({
      image: category.image_url!,
      title: category.name,
      subtitle: "Explorar sabores",
    }));

  const fallbackItems = products
    .filter((product) => Boolean(product.image_url))
    .slice(0, 5)
    .map((product) => ({
      image: product.image_url!,
      title: product.name,
      subtitle: "Feito na hora",
    }));

  const items = categoryItems.length >= 2 ? categoryItems : fallbackItems;

  if (items.length === 0) return null;

  return (
    <div className="ppp-reference-category-accordion mb-10">
      <ImageAccordion
        items={items}
        className="h-[270px] sm:h-[350px] lg:h-[390px]"
      />
    </div>
  );
}
