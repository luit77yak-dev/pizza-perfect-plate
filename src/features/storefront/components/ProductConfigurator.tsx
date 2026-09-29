import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Circle, Pizza, X } from "lucide-react";
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

  return (
    <div
      className="ppp-order-builder fixed inset-0 z-[120] flex items-end justify-center bg-foreground/55 p-0 backdrop-blur-md sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={"Montar " + product.name}
    >
      <div className="flex h-[88dvh] max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] border border-border/70 bg-background shadow-[0_24px_80px_rgba(0,0,0,.35)] sm:h-[86vh] sm:max-h-[86vh] sm:rounded-[2rem]">
        <div className="relative shrink-0 overflow-hidden border-b bg-foreground px-5 pb-5 pt-4 text-background sm:px-6">
          <div className="absolute -right-10 -top-16 size-40 rounded-full bg-primary/25 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <div className="size-14 shrink-0 overflow-hidden rounded-2xl border border-background/15 bg-background/10 shadow-lg sm:size-16">
              {product.image_url ? (
                <img src={product.image_url} alt="" className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center font-display text-2xl text-background/40">
                  <Pizza className="size-8" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-background/60">
                  Montar pedido · {step}/{totalSteps}
                </p>
                <button
                  onClick={onClose}
                  aria-label="Fechar"
                  className="rounded-full border border-background/15 p-2 text-background/80 transition hover:bg-background/10 hover:text-background"
                >
                  <X className="size-5" />
                </button>
              </div>
              <h2 className="mt-1 truncate font-display text-2xl tracking-[-.03em]">
                {product.name}
              </h2>
              <p className="mt-1 text-xs text-background/60">
                {stepTitle} · personalize do seu jeito
              </p>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-b bg-card px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-2">
            {["Escolha", "Personalize", "Finalize"].map((label, index) => {
              const active = index + 1 === step;
              const complete = index + 1 < step;
              return (
                <div key={label} className="flex min-w-0 flex-1 items-center gap-2">
                  <div
                    className={
                      "grid size-8 shrink-0 place-items-center rounded-full border text-[10px] font-bold transition-all " +
                      (active
                        ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/.12)]"
                        : complete
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-background text-muted-foreground")
                    }
                  >
                    {complete ? <Check className="size-3.5" /> : index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        "truncate text-[10px] font-semibold uppercase tracking-[.14em] " +
                        (active || complete ? "text-foreground" : "text-muted-foreground")
                      }
                    >
                      {label}
                    </p>
                    <div
                      className={
                        "mt-1 h-1 rounded-full " + (complete || active ? "bg-primary" : "bg-muted")
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          {step === 1 && (
            <section className="space-y-5">
              <div className="rounded-xl border bg-card p-3">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">
                  Produto principal
                </p>
                <p className="mt-1 text-lg font-semibold">{product.name}</p>
                {product.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
                )}
              </div>

              <div>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
                      01 · Escolha o tamanho
                    </p>
                    <p className="mt-1 text-lg font-semibold tracking-tight">
                      Qual vai ser o tamanho?
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Toque para escolher
                  </span>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {data.sizes.map((size, index) => {
                    const price = getPrice(product, size.id, data.prices);
                    const selected = sizeId === size.id;
                    return (
                      <button
                        key={size.id}
                        onClick={() => setSizeId(size.id)}
                        className={
                          "group relative overflow-hidden rounded-xl border p-2.5 text-left transition-all duration-200 " +
                          (selected
                            ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_20px_hsl(var(--primary)/.16)] ring-1 ring-primary/20"
                            : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md")
                        }
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={
                              "grid size-9 shrink-0 place-items-center rounded-lg border text-xl transition-transform group-hover:scale-105  +
                              (selected
                                ? "border-primary-foreground/20 bg-primary-foreground/10"
                                : "border-border bg-muted")
                            }
                          >
                            <span aria-hidden="true">
                              <Pizza className="size-5" />
                            </span>
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
                            {selected && (
                              <span className="text-[8px] font-bold uppercase tracking-widest opacity-70">
                                Selecionado
                              </span>
                            )}
                          </div>
                        </div>
                        <div
                          className={
                            "absolute -right-8 -top-8 size-20 rounded-full blur-2xl " +
                            (selected ? "bg-primary-foreground/15" : "bg-primary/5")
                          }
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {product.allow_half && (
                <div>
                  <div className="mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
                      02 · Formato
                    </p>
                    <p className="mt-1 text-lg font-semibold tracking-tight">
                      Como você quer sua pizza?
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setHalfMode(false);
                        setSecondProductId(null);
                      }}
                      className={
                        "group relative overflow-hidden rounded-2xl border p-4 text-left transition-all " +
                        (!halfMode
                          ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_22px_hsl(var(--primary)/.16)] ring-2 ring-primary/20"
                          : "bg-card hover:border-primary/50 hover:shadow-md")
                      }
                      aria-pressed={!halfMode}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div
                          className={
                            "relative grid size-11 place-items-center overflow-hidden rounded-xl border text-lg " +
                            (!halfMode
                              ? "border-primary-foreground/15 bg-primary-foreground/10"
                              : "border-border bg-muted")
                          }
                        >
                          <div className="absolute inset-y-0 left-0 w-1/2 bg-background/15" />
                          <div className="absolute inset-y-0 right-0 w-1/2 bg-primary/30" />
                          <Pizza className="relative z-10 size-5" />
                        </div>
                        {!halfMode && (
                          <span className="rounded-full bg-primary-foreground/15 px-2.5 py-1 text-[8px] font-bold uppercase tracking-widest">
                            Selecionado
                          </span>
                        )}
                      </div>
                      <p className="font-bold">Pizza inteira</p>
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
                      className={
                        "group relative overflow-hidden rounded-2xl border p-4 text-left transition-all " +
                        (halfMode
                          ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_22px_hsl(var(--primary)/.16)] ring-2 ring-primary/20"
                          : "bg-card hover:border-primary/50 hover:shadow-md")
                      }
                      aria-pressed={halfMode}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div
                          className={
                            "relative grid size-11 place-items-center overflow-hidden rounded-xl border " +
                            (halfMode
                              ? "border-primary-foreground/15 bg-primary-foreground/10"
                              : "border-border bg-muted")
                          }
                        >
                          <div
                            className={
                              "absolute inset-y-0 left-0 w-1/2 " +
                              (halfMode ? "bg-primary-foreground/15" : "bg-muted-foreground/10")
                            }
                          />
                          <div
                            className={
                              "absolute inset-y-0 right-0 w-1/2 " +
                              (halfMode ? "bg-primary-foreground/35" : "bg-primary/10")
                            }
                          />
                          <Circle className="relative z-10 size-5" />
                        </div>
                        {halfMode && (
                          <span className="rounded-full bg-primary-foreground/15 px-2.5 py-1 text-[8px] font-bold uppercase tracking-widest">
                            Selecionado
                          </span>
                        )}
                      </div>
                      <p className="font-bold">Meio a meio</p>
                      <p
                        className={
                          "mt-1 text-xs " +
                          (halfMode ? "text-primary-foreground/75" : "text-muted-foreground")
                        }
                      >
                        2 sabores · metade de cada
                      </p>
                    </button>
                  </div>

                  {halfMode && (
                    <div className="mt-3 flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-3.5 py-3">
                      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <span className="text-sm font-bold">2</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          Você escolheu meio a meio
                        </p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                          Agora escolha o <strong>segundo sabor</strong>. O primeiro já é{" "}
                          <strong>{product.name}</strong>.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {product.allow_half && halfMode && (
                <div
                  ref={personalizationScrollRef}
                  className="scroll-mt-4 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm"
                >
                  <div className="mb-4 flex items-start gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Circle className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold">Escolha o segundo sabor</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Primeiro sabor: <strong>{product.name}</strong>. Agora escolha a outra
                        metade.
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-primary">
                        {selectedSize?.name
                          ? selectedSize.name + " · " + formatCurrency(basePrice)
                          : "Escolha um tamanho primeiro"}
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
                              "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left " +
                              (selected
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "bg-background")
                            }
                          >
                            <span>
                              <span className="block text-sm font-semibold">{item.name}</span>
                              <span className="text-xs text-muted-foreground">
                                Segunda metade · {formatCurrency(price)}
                              </span>
                            </span>
                            <span className="text-right">
                              <span className="block text-sm font-bold">
                                {formatCurrency(previewPrice)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                total da pizza
                              </span>
                            </span>
                          </button>
                        );
                      })}
                  </div>
                  {secondProduct && (
                    <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
                      <div className="flex items-center gap-3">
                        <div className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-primary/20 bg-background">
                          <div className="absolute inset-y-0 left-0 w-1/2 bg-primary/20" />
                          <div className="absolute inset-y-0 right-0 w-1/2 bg-primary/45" />
                          <Pizza className="relative z-10 size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                            Pizza montada
                          </p>
                          <p className="truncate text-sm font-semibold">
                            {product.name} + {secondProduct.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ½ {product.name} · ½ {secondProduct.name}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold">
                          {formatCurrency(halfBasePrice)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="space-y-4">
              {data.crusts.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-primary">Borda</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {data.crusts.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setCrustId(crustId === item.id ? null : item.id)}
                        className={
                          "flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm " +
                          (crustId === item.id ? "border-primary bg-primary/5" : "bg-card")
                        }
                      >
                        <span>{item.name}</span>
                        <span className="font-semibold">
                          {Number(item.price) > 0
                            ? "+" + formatCurrency(Number(item.price))
                            : "Grátis"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {availableAddons.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-primary">Adicionais</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {availableAddons.map((item) => {
                      const checked = addonIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleAddon(item.id)}
                          className={
                            "flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm " +
                            (checked ? "border-primary bg-primary/5" : "bg-card")
                          }
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={
                                "flex size-5 items-center justify-center rounded-md border " +
                                (checked ? "border-primary bg-primary text-primary-foreground" : "")
                              }
                            >
                              {checked ? <Check className="size-3.5" /> : null}
                            </span>
                            {item.name}
                          </span>
                          <span className="font-semibold">
                            +{formatCurrency(Number(item.price))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="product-notes" className="mb-2 block text-[10px] font-bold uppercase tracking-[.16em] text-primary">
                  Observações
                </label>
                <Textarea
                  id="product-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Alguma observação? (opcional)"
                  className="min-h-[72px] resize-none rounded-xl"
                  rows={2}
                  maxLength={300}
                />
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <div className="mb-5 rounded-2xl border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">
                  Últimos detalhes
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escolha bebidas e acompanhamentos para adicionar junto com esta pizza.
                </p>
              </div>

              {comboProducts.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {comboProducts.map((item) => {
                    const checked = comboProductIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleCombo(item.id)}
                        className={
                          "flex items-center gap-3 rounded-2xl border p-3 text-left " +
                          (checked ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card")
                        }
                      >
                        <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                          {item.image_url ? (
                            <img src={item.image_url} alt="" className="size-full object-cover" />
                          ) : (
                            <div className="flex size-full items-center justify-center font-display text-lg text-primary/40">
                              {item.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{item.name}</span>
                          <span className="text-xs text-muted-foreground">Adicionar ao pedido</span>
                        </span>
                        <span className="shrink-0 text-sm font-bold">
                          {formatCurrency(Number(item.base_price) || 0)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum acompanhamento ou bebida disponível no momento.
                </div>
              )}

              <div className="mt-5 rounded-2xl bg-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {product.name}
                      {secondProduct ? " + " + secondProduct.name : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedSize?.name ?? "Sem tamanho"} · {addons.length} adicional(is)
                      {crust ? " · " + crust.name : ""}
                    </p>
                  </div>
                  <p className="font-bold">{formatCurrency(unitPrice * quantity)}</p>
                </div>
                {comboProductIds.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    + {comboProductIds.length} complemento(s) serão adicionados ao carrinho.
                  </p>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="relative z-20 shrink-0 border-t border-primary/10 bg-card px-3 pb-[calc(.35rem+env(safe-area-inset-bottom))] pt-1.5 sm:px-4 sm:py-2.5 shadow-[0_-8px_20px_rgba(0,0,0,.12)]">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="rounded-full bg-primary px-2 py-0.5 text-[8px] font-bold text-primary-foreground">
              {quantity} {quantity === 1 ? "pizza" : "pizzas"}
            </span>
            <div className="flex min-w-0 items-baseline gap-1.5">
              <span className="truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                {step < totalSteps ? "Seu pedido" : "Total"}
              </span>
              <span className="whitespace-nowrap text-xs font-black tracking-tight text-foreground">
                {formatCurrency(unitPrice * quantity)}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={step > 1 ? previousStep : onClose}
              className="flex h-10 w-full min-w-0 items-center justify-center whitespace-nowrap rounded-full border border-foreground bg-foreground px-2 text-xs font-semibold text-background shadow-sm transition active:scale-[.98] hover:bg-foreground/90"
            >
              {step > 1 ? "Voltar" : "Cancelar"}
            </button>
            {step < totalSteps ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={step === 1 && product.allow_half && halfMode && !secondProductId}
                className="flex h-9 w-full min-w-0 items-center justify-center gap-1 overflow-hidden rounded-full bg-primary px-2 text-[11px] font-bold text-primary-foreground shadow-[0_6px_16px_hsl(var(--primary)/.18)] transition active:scale-[.98] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
              >
                <span className="truncate">
                  {step === 1 && product.allow_half && halfMode && !secondProductId
                    ? "Escolha o segundo sabor"
                    : "Próxima etapa"}
                </span>
                {!(step === 1 && product.allow_half && halfMode && !secondProductId) && (
                  <ChevronRight className="size-3.5 shrink-0" />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={addToCart}
                className="flex h-9 w-full min-w-0 items-center justify-center overflow-hidden rounded-full bg-primary px-2 text-[11px] font-bold text-primary-foreground shadow-[0_6px_16px_hsl(var(--primary)/.18)] transition active:scale-[.98] hover:brightness-105 sm:px-4"
              >
                <span className="truncate">
                  Adicionar ao carrinho · {formatCurrency(unitPrice * quantity)}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
