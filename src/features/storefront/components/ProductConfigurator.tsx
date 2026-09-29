import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Pizza, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/domain/money";
import { calculateProductUnitPrice } from "@/lib/domain/pricing";
import type { CartItem, Product } from "@/lib/domain/types";
import type { StoreData } from "@/features/storefront/services/load-store";
import { getPrice } from "@/features/storefront/domain/storefront-utils";

export function ProductConfigurator({
  product,
  data,
  onClose,
  onAdded,
}: {
  product: Product;
  data: StoreData;
  onClose: () => void;
  onAdded: (items: CartItem[]) => void;
}) {
  const [step, setStep] = useState(1);
  const [sizeId, setSizeId] = useState<string | null>(data.sizes[0]?.id ?? null);
  const [secondProductId, setSecondProductId] = useState<string | null>(null);
  const [halfMode, setHalfMode] = useState(false);
  const [crustId, setCrustId] = useState<string | null>(null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [comboProductIds, setComboProductIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);
  const personalizationScrollRef = useRef<HTMLDivElement | null>(null);

  const secondProduct = data.products.find((item) => item.id === secondProductId) ?? null;
  const comboProducts = data.products.filter((item) => {
    const categoryName =
      data.categories.find((category) => category.id === item.category_id)?.name ?? "";
    const normalizedCategory = categoryName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
    return (
      item.kind === "SIMPLE" ||
      /(bebida|bebidas|doce|doces|sobremesa|sobremesas|acompanhamento|acompanhamentos)/i.test(
        normalizedCategory,
      )
    );
  });
  const selectedSize = data.sizes.find((size) => size.id === sizeId) ?? null;
  const basePrice = getPrice(product, sizeId, data.prices);
  const secondBasePrice = secondProduct ? getPrice(secondProduct, sizeId, data.prices) : basePrice;
  const crust = data.crusts.find((item) => item.id === crustId);
  const productAddonIds = (data.productAddonLinks ?? [])
    .filter((link) => link.product_id === product.id || link.product_id === secondProduct?.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((link) => link.addon_id);
  const availableAddonIds = new Set(productAddonIds);
  const availableAddons = data.addons.filter((item) => availableAddonIds.has(item.id));
  const addons = availableAddons.filter((item) => addonIds.includes(item.id));
  const halfBasePrice = secondProduct
    ? calculateProductUnitPrice({
        basePrice,
        secondBasePrice,
        isHalf: true,
        halfRule: data.settings.half_pizza_pricing_rule,
        halfFixedPrice: data.settings.half_pizza_fixed_price,
      })
    : basePrice;
  const unitPrice = calculateProductUnitPrice({
    basePrice,
    secondBasePrice,
    isHalf: halfMode && Boolean(secondProductId),
    halfRule: data.settings.half_pizza_pricing_rule,
    halfFixedPrice: data.settings.half_pizza_fixed_price,
    crustPrice: crust?.price ?? 0,
    addonPrices: addons.map((item) => item.price),
  });

  const totalSteps = 3;
  const nextStep = () => setStep((current) => Math.min(totalSteps, current + 1));
  const previousStep = () => setStep((current) => Math.max(1, current - 1));

  useEffect(() => {
    if (!halfMode) return;
    requestAnimationFrame(() => {
      personalizationScrollRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [halfMode]);

  const toggleAddon = (id: string) => {
    setAddonIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const toggleCombo = (id: string) => {
    setComboProductIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const addToCart = () => {
    const mainItem: CartItem = {
      lineId: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      imageUrl: product.image_url,
      secondProductId: secondProduct?.id ?? null,
      secondProductName: secondProduct?.name ?? null,
      isHalf: halfMode && Boolean(secondProduct),
      sizeId,
      sizeName: selectedSize?.name ?? null,
      crustId,
      crustName: crust?.name ?? null,
      crustPrice: Number(crust?.price ?? 0),
      addons: addons.map((addon) => ({
        id: addon.id,
        name: addon.name,
        price: Number(addon.price),
      })),
      complements: comboProductIds
        .map((id) => data.products.find((item) => item.id === id))
        .filter((item): item is Product => Boolean(item))
        .map((item) => ({
          productId: item.id,
          productName: item.name,
          imageUrl: item.image_url,
          price: Number(item.base_price) || 0,
        })),
      quantity,
      notes: notes.trim() || null,
      unitPrice:
        unitPrice +
        comboProductIds.reduce((sum, id) => {
          const item = data.products.find((product) => product.id === id);
          return sum + (Number(item?.base_price) || 0);
        }, 0),
    };

    onAdded([mainItem]);
  };

  const stepTitle = step === 1 ? "Escolha" : step === 2 ? "Personalize" : "Finalize";
  const complementsTotal = comboProductIds.reduce((sum, id) => {
    const item = data.products.find((item) => item.id === id);
    return sum + (Number(item?.base_price) || 0);
  }, 0);
  const totalPrice = (unitPrice + complementsTotal) * quantity;

  return (
<div
      className="ppp-order-builder fixed inset-0 z-[120] flex items-end justify-center bg-foreground/60 p-0 backdrop-blur-md sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={"Montar " + product.name}
    >
      <div className="flex h-[94dvh] max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[2rem] border border-border/70 bg-background shadow-[0_28px_90px_rgba(0,0,0,.32)] sm:h-[90vh] sm:max-h-[90vh] sm:rounded-[2rem]">
        <header className="relative shrink-0 overflow-hidden border-b bg-foreground px-4 py-3.5 text-background sm:px-6 sm:py-4">
          <div className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-primary/25 blur-3xl" />
          <div className="relative flex items-center gap-3 sm:gap-4">
            <div className="size-14 shrink-0 overflow-hidden rounded-2xl border border-background/15 bg-background/10 shadow-lg sm:size-16">
              {product.image_url ? (
                <img src={product.image_url} alt="" className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-background/45">
                  <Pizza className="size-7" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-background/15 bg-background/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[.16em] text-background/70">
                  {step}/{totalSteps}
                </span>
                <span className="hidden text-[10px] font-medium text-background/50 sm:inline">
                  {stepTitle}
                </span>
              </div>
              <h2 className="mt-1 truncate font-display text-xl tracking-[-.03em] sm:text-2xl">
                {product.name}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="shrink-0 rounded-full border border-background/15 p-2 text-background/75 transition hover:bg-background/10 hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        <div className="shrink-0 border-b bg-card px-4 py-2.5 sm:px-6 sm:py-3">
          <div className="mx-auto flex max-w-3xl items-center gap-2 sm:gap-3">
            {["Escolha", "Personalize", "Finalize"].map((label, index) => {
              const active = index + 1 === step;
              const complete = index + 1 < step;

              return (
                <div key={label} className="flex min-w-0 flex-1 items-center gap-2">
                  <div
                    className={
                      "grid size-7 shrink-0 place-items-center rounded-full border text-[9px] font-bold transition-all sm:size-8 " +
                      (active
                        ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/.10)]"
                        : complete
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground")
                    }
                  >
                    {complete ? <Check className="size-3.5" /> : index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        "truncate text-[9px] font-bold uppercase tracking-[.14em] sm:text-[10px] " +
                        (active || complete ? "text-foreground" : "text-muted-foreground")
                      }
                    >
                      {label}
                    </p>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={
                          "h-full rounded-full transition-all duration-300 " +
                          (complete || active ? "w-full bg-primary" : "w-0")
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/20 px-4 py-5 sm:px-7 sm:py-6">
          {step === 1 && (
            <section className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[minmax(0,1fr)_270px] lg:items-start">
              <div className="space-y-7">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
                    Comece por aqui
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-[-.03em]">
                    Monte sua pizza
                  </h3>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                    Escolha o tamanho e, se quiser, combine dois sabores na mesma pizza.
                  </p>
                </div>

                <div>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">
                        01 · Tamanho
                      </p>
                      <p className="mt-1 text-base font-semibold">Qual vai ser o tamanho?</p>
                    </div>
                    <span className="hidden rounded-full border bg-card px-2.5 py-1 text-[9px] font-semibold text-muted-foreground sm:inline">
                      Toque para escolher
                    </span>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {data.sizes.map((size) => {
                      const price = getPrice(product, size.id, data.prices);
                      const selected = sizeId === size.id;

                      return (
                        <button
                          key={size.id}
                          type="button"
                          onClick={() => setSizeId(size.id)}
                          className={
                            "group relative rounded-2xl border p-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                            (selected
                              ? "border-primary bg-primary text-primary-foreground shadow-[0_10px_24px_hsl(var(--primary)/.14)]"
                              : "border-border/80 bg-card hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md")
                          }
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={
                                "grid size-11 shrink-0 place-items-center rounded-xl border text-xl transition-transform group-hover:scale-105 " +
                                (selected
                                  ? "border-primary-foreground/15 bg-primary-foreground/10"
                                  : "border-border bg-muted")
                              }
                            >
                              <Pizza className="size-5" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <span className="block text-sm font-bold">{size.name}</span>
                              {size.slices ? (
                                <span
                                  className={
                                    "mt-0.5 block text-[11px] " +
                                    (selected
                                      ? "text-primary-foreground/70"
                                      : "text-muted-foreground")
                                  }
                                >
                                  {size.slices} fatias
                                </span>
                              ) : null}
                            </div>

                            <div className="text-right">
                              <span className="block text-sm font-bold">{formatCurrency(price)}</span>
                              <span
                                className={
                                  "mt-0.5 block text-[8px] font-bold uppercase tracking-widest " +
                                  (selected
                                    ? "text-primary-foreground/65"
                                    : "text-muted-foreground")
                                }
                              >
                                {selected ? "Escolhido" : "Selecionar"}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {product.allow_half && (
                  <div>
                    <div className="mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">
                        02 · Formato
                      </p>
                      <p className="mt-1 text-base font-semibold">Um sabor ou meio a meio?</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setHalfMode(false);
                          setSecondProductId(null);
                        }}
                        aria-pressed={!halfMode}
                        className={
                          "rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                          (!halfMode
                            ? "border-primary bg-primary text-primary-foreground shadow-[0_10px_24px_hsl(var(--primary)/.14)]"
                            : "border-border/80 bg-card hover:border-primary/45 hover:shadow-md")
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className={
                              "grid size-11 place-items-center rounded-xl border " +
                              (!halfMode
                                ? "border-primary-foreground/15 bg-primary-foreground/10"
                                : "border-border bg-muted")
                            }
                          >
                            <Pizza className="size-5" />
                          </div>
                          {!halfMode && (
                            <span className="rounded-full bg-primary-foreground/12 px-2 py-1 text-[8px] font-bold uppercase tracking-widest">
                              Escolhido
                            </span>
                          )}
                        </div>
                        <p className="mt-4 font-bold">Pizza inteira</p>
                        <p
                          className={
                            "mt-1 text-xs " +
                            (!halfMode ? "text-primary-foreground/70" : "text-muted-foreground")
                          }
                        >
                          1 sabor · {product.name}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setHalfMode(true);
                          requestAnimationFrame(() => {
                            personalizationScrollRef.current?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                          });
                        }}
                        aria-pressed={halfMode}
                        className={
                          "rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                          (halfMode
                            ? "border-primary bg-primary text-primary-foreground shadow-[0_10px_24px_hsl(var(--primary)/.14)]"
                            : "border-border/80 bg-card hover:border-primary/45 hover:shadow-md")
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className={
                              "relative grid size-11 place-items-center overflow-hidden rounded-xl border " +
                              (halfMode
                                ? "border-primary-foreground/15 bg-primary-foreground/10"
                                : "border-border bg-muted")
                            }
                          >
                            <div className="absolute inset-y-0 left-0 w-1/2 bg-primary/25" />
                            <div className="absolute inset-y-0 right-0 w-1/2 bg-foreground/10" />
                            <span className="relative z-10 text-sm font-bold">½</span>
                          </div>
                          {halfMode && (
                            <span className="rounded-full bg-primary-foreground/12 px-2 py-1 text-[8px] font-bold uppercase tracking-widest">
                              Escolhido
                            </span>
                          )}
                        </div>
                        <p className="mt-4 font-bold">Meio a meio</p>
                        <p
                          className={
                            "mt-1 text-xs " +
                            (halfMode ? "text-primary-foreground/70" : "text-muted-foreground")
                          }
                        >
                          2 sabores · metade de cada
                        </p>
                      </button>
                    </div>
                  </div>
                )}

                {product.allow_half && halfMode && (
                  <div
                    ref={personalizationScrollRef}
                    className="scroll-mt-4 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm"
                  >
                    <div className="mb-4 flex items-start gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <span className="text-sm font-bold">½</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold">Escolha o segundo sabor</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Primeiro sabor: <strong>{product.name}</strong>. Agora escolha a outra metade.
                        </p>
                      </div>
                    </div>

                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {data.products
                        .filter((item) => item.kind === "PIZZA" && item.id !== product.id)
                        .map((item) => {
                          const price = getPrice(item, sizeId, data.prices);
                          const selected = secondProductId === item.id;
                          const previewPrice = calculateProductUnitPrice({
                            basePrice,
                            secondBasePrice: price,
                            isHalf: true,
                            halfRule: data.settings.half_pizza_pricing_rule,
                            halfFixedPrice: data.settings.half_pizza_fixed_price,
                          });

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSecondProductId(item.id)}
                              className={
                                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                                (selected
                                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                                  : "border-border/70 bg-background hover:border-primary/35")
                              }
                            >
                              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                                <Pizza className="size-4 text-primary/70" />
                              </div>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold">{item.name}</span>
                                <span className="text-[11px] text-muted-foreground">
                                  Segunda metade · {formatCurrency(price)}
                                </span>
                              </span>
                              <span className="shrink-0 text-right">
                                <span className="block text-sm font-bold">{formatCurrency(previewPrice)}</span>
                                <span className="text-[9px] text-muted-foreground">pizza</span>
                              </span>
                              {selected && <Check className="size-4 shrink-0 text-primary" />}
                            </button>
                          );
                        })}
                    </div>

                    {secondProduct && (
                      <div className="mt-3 flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
                        <div className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-primary/15 bg-background">
                          <div className="absolute inset-y-0 left-0 w-1/2 bg-primary/15" />
                          <div className="absolute inset-y-0 right-0 w-1/2 bg-primary/35" />
                          <span className="relative z-10 text-xs font-bold">½</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-primary">
                            Pizza montada
                          </p>
                          <p className="truncate text-sm font-semibold">
                            {product.name} + {secondProduct.name}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold">{formatCurrency(halfBasePrice)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <aside className="hidden lg:block">
                <div className="sticky top-0 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                  <p className="text-[9px] font-bold uppercase tracking-[.18em] text-primary">
                    Seu pedido
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="size-12 overflow-hidden rounded-xl bg-muted">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="grid size-full place-items-center text-primary/40">
                          <Pizza className="size-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{product.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedSize?.name ?? "Escolha um tamanho"}
                      </p>
                    </div>
                  </div>
                  <div className="my-4 h-px bg-border" />
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Base</span>
                      <span className="font-semibold">{formatCurrency(basePrice)}</span>
                    </div>
                    {secondProduct && (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Meio a meio</span>
                        <span className="font-semibold">2 sabores</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 rounded-xl bg-muted p-3">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      A partir de
                    </span>
                    <span className="mt-0.5 block text-xl font-black">{formatCurrency(unitPrice)}</span>
                  </div>
                </div>
              </aside>
            </section>
          )}

          {step === 2 && (
            <section className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[minmax(0,1fr)_270px] lg:items-start">
              <div className="space-y-7">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
                    Personalização
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-[-.03em]">
                    Deixe do seu jeito
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Escolha sua borda, adicione extras e deixe uma observação para a cozinha.
                  </p>
                </div>

                {data.crusts.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">
                          01 · Borda
                        </p>
                        <p className="mt-1 text-base font-semibold">Escolha o acabamento</p>
                      </div>
                      {crust && (
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-bold text-primary">
                          {crust.name}
                        </span>
                      )}
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {data.crusts.map((item) => {
                        const selected = crustId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setCrustId(selected ? null : item.id)}
                            aria-pressed={selected}
                            className={
                              "flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                              (selected
                                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                                : "border-border/80 bg-card hover:border-primary/35 hover:shadow-sm")
                            }
                          >
                            <div
                              className={
                                "grid size-10 shrink-0 place-items-center rounded-xl border " +
                                (selected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-muted")
                              }
                            >
                              {selected ? <Check className="size-4" /> : <Pizza className="size-4 text-primary/60" />}
                            </div>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold">{item.name}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {Number(item.price) > 0
                                  ? "+" + formatCurrency(Number(item.price))
                                  : "Sem custo adicional"}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {availableAddons.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">
                          02 · Adicionais
                        </p>
                        <p className="mt-1 text-base font-semibold">Quer deixar ainda melhor?</p>
                      </div>
                      {addons.length > 0 && (
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-bold text-primary">
                          {addons.length} selecionado{addons.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {availableAddons.map((item) => {
                        const checked = addonIds.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleAddon(item.id)}
                            aria-pressed={checked}
                            className={
                              "flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                              (checked
                                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                                : "border-border/80 bg-card hover:border-primary/35 hover:shadow-sm")
                            }
                          >
                            <span
                              className={
                                "grid size-6 shrink-0 place-items-center rounded-full border transition-all " +
                                (checked
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background")
                              }
                            >
                              {checked ? <Check className="size-3.5" /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold">{item.name}</span>
                              <span className="text-[11px] text-muted-foreground">
                                +{formatCurrency(Number(item.price))}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">
                      03 · Observação
                    </p>
                    <p className="mt-1 text-base font-semibold">Algum detalhe importante?</p>
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-sm">
                    <Textarea
                      id="product-notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Ex.: cortar em 8 pedaços, pouca cebola..."
                      maxLength={300}
                      className="min-h-24 resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                    />
                    <div className="flex justify-end px-1 pt-1 text-[9px] text-muted-foreground">
                      {notes.length}/300
                    </div>
                  </div>
                </div>
              </div>

              <aside className="hidden lg:block">
                <div className="sticky top-0 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                  <p className="text-[9px] font-bold uppercase tracking-[.18em] text-primary">
                    Resumo
                  </p>
                  <p className="mt-1 text-sm font-bold">{product.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {selectedSize?.name ?? "Sem tamanho"}
                    {secondProduct ? " · meio a meio" : ""}
                  </p>

                  <div className="my-4 h-px bg-border" />

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Borda</span>
                      <span className="max-w-[130px] truncate font-semibold">
                        {crust?.name ?? "Nenhuma"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Adicionais</span>
                      <span className="font-semibold">{addons.length}</span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-muted p-3">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      Subtotal
                    </span>
                    <span className="mt-0.5 block text-xl font-black">{formatCurrency(unitPrice)}</span>
                  </div>
                </div>
              </aside>
            </section>
          )}

          {step === 3 && (
            <section className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[minmax(0,1fr)_270px] lg:items-start">
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
                    Últimos detalhes
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-[-.03em]">
                    Quer completar o pedido?
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Bebidas e acompanhamentos são opcionais. Se não quiser nada, é só avançar para adicionar a pizza.
                  </p>
                </div>

                {comboProducts.length > 0 ? (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {comboProducts.map((item) => {
                      const checked = comboProductIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleCombo(item.id)}
                          aria-pressed={checked}
                          className={
                            "group flex items-center gap-3 rounded-2xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                            (checked
                              ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                              : "border-border/80 bg-card hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-sm")
                          }
                        >
                          <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                            {item.image_url ? (
                              <img src={item.image_url} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                            ) : (
                              <div className="grid size-full place-items-center text-primary/45">
                                <Pizza className="size-5" />
                              </div>
                            )}
                          </div>

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{item.name}</span>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {formatCurrency(Number(item.base_price) || 0)}
                            </span>
                          </span>

                          <span
                            className={
                              "grid size-7 shrink-0 place-items-center rounded-full border transition-all " +
                              (checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background text-transparent")
                            }
                          >
                            <Check className="size-3.5" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
                    Nenhum acompanhamento ou bebida disponível no momento.
                  </div>
                )}

                <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-[.16em] text-primary">
                        Revisão
                      </p>
                      <p className="mt-1 truncate text-sm font-bold">
                        {product.name}
                        {secondProduct ? " + " + secondProduct.name : ""}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {selectedSize?.name ?? "Sem tamanho"} · {addons.length} adicional(is)
                        {crust ? " · " + crust.name : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-lg font-black">{formatCurrency(totalPrice)}</span>
                  </div>

                  {comboProductIds.length > 0 && (
                    <div className="mt-3 flex items-center justify-between border-t pt-3 text-[11px]">
                      <span className="text-muted-foreground">
                        {comboProductIds.length} complemento(s)
                      </span>
                      <span className="font-semibold">+{formatCurrency(complementsTotal)}</span>
                    </div>
                  )}
                </div>
              </div>

              <aside className="hidden lg:block">
                <div className="sticky top-0 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                  <p className="text-[9px] font-bold uppercase tracking-[.18em] text-primary">
                    Tudo certo?
                  </p>
                  <div className="mt-3 rounded-xl bg-muted p-4">
                    <p className="text-xs font-semibold">
                      {product.name}
                      {secondProduct ? " + " + secondProduct.name : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {selectedSize?.name ?? "Sem tamanho"}
                    </p>
                  </div>

                  <div className="my-4 h-px bg-border" />

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pizza</span>
                      <span className="font-semibold">{formatCurrency(unitPrice)}</span>
                    </div>
                    {complementsTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Complementos</span>
                        <span className="font-semibold">{formatCurrency(complementsTotal)}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 border-t pt-4">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      Total
                    </span>
                    <span className="mt-0.5 block text-2xl font-black">{formatCurrency(totalPrice)}</span>
                  </div>
                </div>
              </aside>
            </section>
          )}
        </main>

        <footer className="relative z-20 shrink-0 border-t border-border/70 bg-card px-3 pb-[calc(.45rem+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-10px_28px_rgba(0,0,0,.10)] sm:px-5 sm:py-3">
          <div className="mx-auto flex max-w-4xl items-center gap-2.5 sm:gap-3">
            <div className="hidden items-center rounded-full border bg-background p-1 sm:flex">
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                aria-label="Diminuir quantidade"
                className="grid size-7 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                −
              </button>
              <span className="w-7 text-center text-xs font-bold">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((current) => current + 1)}
                aria-label="Aumentar quantidade"
                className="grid size-7 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                +
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[9px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                {quantity} {quantity === 1 ? "item" : "itens"} · {step < totalSteps ? stepTitle : "pronto"}
              </p>
              <p className="truncate text-sm font-black tracking-tight">{formatCurrency(totalPrice)}</p>
            </div>

            <button
              type="button"
              onClick={step > 1 ? previousStep : onClose}
              className="flex h-10 shrink-0 items-center justify-center rounded-full border border-foreground bg-foreground px-4 text-xs font-semibold text-background shadow-sm transition active:scale-[.98] hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {step > 1 ? "Voltar" : "Cancelar"}
            </button>

            {step < totalSteps ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={step === 1 && product.allow_half && halfMode && !secondProductId}
                className="flex h-10 min-w-0 max-w-[48%] items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground shadow-[0_7px_18px_hsl(var(--primary)/.20)] transition active:scale-[.98] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:max-w-none sm:px-5"
              >
                <span className="truncate">
                  {step === 1 && product.allow_half && halfMode && !secondProductId
                    ? "Escolha o segundo sabor"
                    : "Continuar"}
                </span>
                {!(step === 1 && product.allow_half && halfMode && !secondProductId) && (
                  <ChevronRight className="size-3.5 shrink-0" />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={addToCart}
                className="flex h-10 min-w-0 max-w-[52%] items-center justify-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground shadow-[0_7px_18px_hsl(var(--primary)/.20)] transition active:scale-[.98] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:max-w-none sm:px-5"
              >
                <span className="truncate">Adicionar · {formatCurrency(totalPrice)}</span>
              </button>
            )}
          </div>

          <div className="mt-2 flex justify-center sm:hidden">
            <div className="flex items-center rounded-full border bg-background p-0.5">
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                aria-label="Diminuir quantidade"
                className="grid size-7 place-items-center rounded-full text-sm text-muted-foreground transition hover:bg-muted"
              >
                −
              </button>
              <span className="w-8 text-center text-[10px] font-bold">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((current) => current + 1)}
                aria-label="Aumentar quantidade"
                className="grid size-7 place-items-center rounded-full text-sm text-muted-foreground transition hover:bg-muted"
              >
                +
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
  );
}
