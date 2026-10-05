import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Pizza, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/domain/money";
import { calculateProductUnitPrice } from "@/lib/domain/pricing";
import type { CartItem, Product } from "@/lib/domain/types";
import type { StoreData } from "@/features/storefront/services/load-store";
import { getPrice } from "@/features/storefront/domain/storefront-utils";

/*
 * Montagem do pedido (3 etapas).
 * Visual premium: folha escura, uma única cor de ação (primary), preços em dourado,
 * rótulos legíveis (sem caixa alta minúscula) e rodapé com um CTA principal.
 * A lógica de preço, meio a meio e carrinho é a mesma da versão anterior.
 *
 * Importante: usa <section>/<div> em vez de <header>, e não usa as classes
 * legadas "ppp-order-builder", para não herdar os remendos globais de CSS.
 */

const STEP_LABELS = ["Tamanho", "Extras", "Revisar"] as const;

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        "grid size-6 shrink-0 place-items-center rounded-full border-2 transition " +
        (selected ? "border-primary" : "border-[#f4eee2]/35")
      }
    >
      {selected && <span className="size-2.5 rounded-full bg-primary" />}
    </span>
  );
}

function optionClass(selected: boolean) {
  return (
    "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition " +
    (selected
      ? "border-primary bg-primary/10"
      : "border-[#f4eee2]/12 bg-[#0a3035] hover:border-[#f4eee2]/30")
  );
}

function chipClass(selected: boolean) {
  return (
    "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm transition " +
    (selected
      ? "border-primary bg-primary/15 font-medium text-[#f4eee2]"
      : "border-[#f4eee2]/15 bg-[#0a3035] text-[#f4eee2]/85 hover:border-[#f4eee2]/35")
  );
}

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
  const [notesOpen, setNotesOpen] = useState(false);
  const [quantity] = useState(1);
  const personalizationScrollRef = useRef<HTMLDivElement | null>(null);
  const stepsScrollRef = useRef<HTMLDivElement | null>(null);

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

  const totalSteps = STEP_LABELS.length;
  const nextStep = () => setStep((current) => Math.min(totalSteps, current + 1));
  const previousStep = () => setStep((current) => Math.max(1, current - 1));

  useEffect(() => {
    if (!halfMode) return;
    requestAnimationFrame(() => {
      personalizationScrollRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [halfMode]);

  useEffect(() => {
    requestAnimationFrame(() => {
      stepsScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [step]);

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

  const comboTotal = comboProductIds.reduce((sum, id) => {
    const item = data.products.find((entry) => entry.id === id);
    return sum + (Number(item?.base_price) || 0);
  }, 0);
  const orderTotal = unitPrice * quantity + comboTotal;
  const needsSecondFlavor =
    step === 1 && Boolean(product.allow_half) && halfMode && !secondProductId;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-0 backdrop-blur-md sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={"Montar " + product.name}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Fechar"
        tabIndex={-1}
      />
      <section className="relative flex h-[92dvh] max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-[#f4eee2]/10 bg-[#06282d] text-[#f4eee2] shadow-[0_30px_90px_rgba(0,0,0,.55)] sm:h-[88vh] sm:max-h-[88vh] sm:rounded-3xl">
        {/* Cabeçalho */}
        <div className="shrink-0 border-b border-[#f4eee2]/10 bg-gradient-to-b from-[#241b11] to-[#06282d] px-5 pb-4 pt-5">
          <div className="flex items-center gap-4">
            <div className="size-16 shrink-0 overflow-hidden rounded-2xl border border-[#f4eee2]/15 bg-[#0a3035]">
              {product.image_url ? (
                <img src={product.image_url} alt="" className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-[#f4eee2]/40">
                  <Pizza className="size-8" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[#f4eee2]/60">Montando seu pedido</p>
              <h2 className="truncate font-display text-[26px] font-medium leading-tight text-[#f4eee2]">
                {product.name}
              </h2>
              {product.description && (
                <p className="truncate text-[13px] text-[#f4eee2]/55">{product.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="grid size-11 shrink-0 place-items-center self-start rounded-full border border-[#f4eee2]/20 text-[#f4eee2] transition hover:bg-white/10"
            >
              <X className="size-5" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Etapas */}
        <div className="shrink-0 px-5 pt-4">
          <ol className="grid grid-cols-3 gap-2">
            {STEP_LABELS.map((label, index) => {
              const number = index + 1;
              const active = number === step;
              const complete = number < step;
              return (
                <li key={label} aria-current={active ? "step" : undefined}>
                  <div
                    className={
                      "h-1 rounded-full transition " +
                      (complete || active ? "bg-primary" : "bg-[#f4eee2]/15")
                    }
                  />
                  <p
                    className={
                      "mt-2 flex items-center gap-1.5 text-[13px] " +
                      (active
                        ? "font-semibold text-[#f4eee2]"
                        : complete
                          ? "text-[#f4eee2]/80"
                          : "text-[#f4eee2]/45")
                    }
                  >
                    {complete ? (
                      <Check className="size-3.5 text-primary" strokeWidth={3} />
                    ) : (
                      <span className="tabular-nums">{number}</span>
                    )}
                    {label}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Conteúdo */}
        <div
          ref={stepsScrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5"
        >
          {step === 1 && (
            <section className="space-y-7">
              <div>
                <h3 className="font-display text-[22px] font-medium">Qual vai ser o tamanho?</h3>
                <div className="mt-3 space-y-2.5">
                  {data.sizes.map((size) => {
                    const price = getPrice(product, size.id, data.prices);
                    const selected = sizeId === size.id;
                    return (
                      <button
                        key={size.id}
                        type="button"
                        onClick={() => setSizeId(size.id)}
                        aria-pressed={selected}
                        className={optionClass(selected)}
                      >
                        <RadioDot selected={selected} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-base font-medium">{size.name}</span>
                          {size.slices ? (
                            <span className="block text-[13px] text-[#f4eee2]/55">
                              {size.slices} fatias
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={
                            "font-display text-lg " +
                            (selected ? "text-[#f3ad4b]" : "text-[#f4eee2]")
                          }
                        >
                          {formatCurrency(price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {product.allow_half && (
                <div>
                  <h3 className="font-display text-[22px] font-medium">Formato da pizza</h3>
                  <div className="mt-3 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setHalfMode(false);
                        setSecondProductId(null);
                      }}
                      aria-pressed={!halfMode}
                      className={optionClass(!halfMode)}
                    >
                      <RadioDot selected={!halfMode} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-medium">Pizza inteira</span>
                        <span className="block text-[13px] text-[#f4eee2]/55">
                          1 sabor, {product.name}
                        </span>
                      </span>
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
                      className={optionClass(halfMode)}
                    >
                      <RadioDot selected={halfMode} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-medium">Meio a meio</span>
                        <span className="block text-[13px] text-[#f4eee2]/55">
                          2 sabores, metade de cada
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {product.allow_half && halfMode && (
                <div ref={personalizationScrollRef} className="scroll-mt-4">
                  <h3 className="font-display text-[22px] font-medium">Escolha a outra metade</h3>
                  <p className="mt-1 text-[13px] text-[#f4eee2]/60">
                    Primeira metade: {product.name}.{" "}
                    {selectedSize?.name
                      ? selectedSize.name + ", " + formatCurrency(basePrice)
                      : "Escolha um tamanho primeiro."}
                  </p>
                  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
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
                            aria-pressed={selected}
                            className={optionClass(selected)}
                          >
                            <RadioDot selected={selected} />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[15px] font-medium">{item.name}</span>
                              <span className="block text-[13px] text-[#f4eee2]/55">
                                Metade a {formatCurrency(price)}
                              </span>
                            </span>
                            <span className="text-right">
                              <span
                                className={
                                  "block font-display text-base " +
                                  (selected ? "text-[#f3ad4b]" : "text-[#f4eee2]")
                                }
                              >
                                {formatCurrency(previewPrice)}
                              </span>
                              <span className="block text-xs text-[#f4eee2]/45">total</span>
                            </span>
                          </button>
                        );
                      })}
                  </div>
                  {secondProduct && (
                    <p className="mt-3 rounded-2xl border border-[#f3ad4b]/25 bg-[#f3ad4b]/[.07] px-4 py-3 text-sm text-[#f4eee2]">
                      Pizza montada: ½ {product.name} e ½ {secondProduct.name},{" "}
                      <span className="font-medium text-[#f3ad4b]">
                        {formatCurrency(halfBasePrice)}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="space-y-7">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#f4eee2]/12 bg-[#0a3035] p-4">
                <div className="min-w-0">
                  <p className="truncate text-base font-medium">
                    {product.name}
                    {secondProduct ? " + " + secondProduct.name : ""}
                  </p>
                  <p className="text-[13px] text-[#f4eee2]/55">
                    {selectedSize?.name ?? "Sem tamanho"},{" "}
                    {halfMode && secondProduct ? "meio a meio" : "pizza inteira"}
                  </p>
                </div>
                <span className="font-display text-lg text-[#f3ad4b]">
                  {formatCurrency(unitPrice * quantity)}
                </span>
              </div>

              {data.crusts.length > 0 && (
                <div>
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-display text-[22px] font-medium">Borda</h3>
                    <span className="text-[13px] text-[#f4eee2]/45">Opcional</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.crusts.map((item) => {
                      const selected = crustId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setCrustId(selected ? null : item.id)}
                          aria-pressed={selected}
                          className={chipClass(selected)}
                        >
                          {selected && <Check className="size-4 text-primary" strokeWidth={3} />}
                          {item.name}
                          <span className="text-[13px] text-[#f4eee2]/55">
                            {Number(item.price) > 0
                              ? "+" + formatCurrency(Number(item.price))
                              : "Grátis"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {availableAddons.length > 0 && (
                <div>
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-display text-[22px] font-medium">Adicionais</h3>
                    <span className="text-[13px] text-[#f4eee2]/45">Toque para adicionar</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {availableAddons.map((item) => {
                      const checked = addonIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleAddon(item.id)}
                          aria-pressed={checked}
                          className={chipClass(checked)}
                        >
                          {checked && <Check className="size-4 text-primary" strokeWidth={3} />}
                          {item.name}
                          <span className="text-[13px] text-[#f4eee2]/55">
                            +{formatCurrency(Number(item.price))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-[#f4eee2]/12 bg-[#0a3035]">
                <button
                  type="button"
                  onClick={() => setNotesOpen((current) => !current)}
                  aria-expanded={notesOpen}
                  className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left"
                >
                  <span>
                    <span className="block text-base font-medium">Observação</span>
                    <span className="block text-[13px] text-[#f4eee2]/50">
                      {notes.trim() ? "Adicionada" : "Opcional"}
                    </span>
                  </span>
                  <span className="text-sm font-medium text-[#f3ad4b]">
                    {notesOpen ? "Fechar" : "Adicionar"}
                  </span>
                </button>
                {notesOpen && (
                  <div className="px-4 pb-4">
                    <Textarea
                      id="product-notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Alguma observação? (opcional)"
                      className="min-h-[72px] resize-none rounded-xl border-[#f4eee2]/15 bg-[#041e22] text-[#f4eee2] placeholder:text-[#f4eee2]/35"
                      rows={2}
                      maxLength={300}
                    />
                  </div>
                )}
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-6">
              <div>
                <h3 className="font-display text-[22px] font-medium">Quer completar o pedido?</h3>
                <p className="mt-1 text-[13px] text-[#f4eee2]/60">
                  Bebidas e acompanhamentos entram junto com esta pizza.
                </p>
              </div>

              {comboProducts.length > 0 ? (
                <div className="space-y-2.5">
                  {comboProducts.map((item) => {
                    const checked = comboProductIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleCombo(item.id)}
                        aria-pressed={checked}
                        className={optionClass(checked)}
                      >
                        <span className="size-14 shrink-0 overflow-hidden rounded-xl bg-[#0d373c]">
                          {item.image_url ? (
                            <img src={item.image_url} alt="" className="size-full object-cover" />
                          ) : (
                            <span className="grid size-full place-items-center font-display text-lg text-[#f4eee2]/40">
                              {item.name.charAt(0)}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-medium">{item.name}</span>
                          <span className="block text-[13px] text-[#f4eee2]/55">
                            {checked ? "Adicionado" : "Toque para adicionar"}
                          </span>
                        </span>
                        <span
                          className={
                            "font-display text-base " +
                            (checked ? "text-[#f3ad4b]" : "text-[#f4eee2]")
                          }
                        >
                          {formatCurrency(Number(item.base_price) || 0)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#f4eee2]/20 p-6 text-center text-sm text-[#f4eee2]/60">
                  Nenhum acompanhamento ou bebida disponível no momento.
                </div>
              )}

              <div className="rounded-2xl border border-[#f4eee2]/12 bg-[#0a3035] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium">
                      {product.name}
                      {secondProduct ? " + " + secondProduct.name : ""}
                    </p>
                    <p className="text-[13px] text-[#f4eee2]/55">
                      {selectedSize?.name ?? "Sem tamanho"}, {addons.length} adicional(is)
                      {crust ? ", borda " + crust.name : ""}
                    </p>
                  </div>
                  <p className="font-display text-lg text-[#f3ad4b]">
                    {formatCurrency(unitPrice * quantity)}
                  </p>
                </div>
                {comboProductIds.length > 0 && (
                  <p className="mt-2 text-[13px] text-[#f4eee2]/60">
                    + {comboProductIds.length} complemento(s) no carrinho.
                  </p>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Rodapé: total + um único botão de ação */}
        <div className="shrink-0 border-t border-[#f4eee2]/10 bg-[#041e22] px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-[13px] text-[#f4eee2]/60">
              {quantity} {quantity === 1 ? "pizza" : "pizzas"} no pedido
            </span>
            <span className="font-display text-[22px] font-medium">
              {formatCurrency(orderTotal)}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={step > 1 ? previousStep : onClose}
              className="h-12 shrink-0 rounded-2xl border border-[#f4eee2]/20 px-5 text-sm font-medium text-[#f4eee2] transition hover:bg-white/10 active:scale-[.98]"
            >
              {step > 1 ? "Voltar" : "Cancelar"}
            </button>
            {step < totalSteps ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={needsSecondFlavor}
                className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-[15px] font-semibold text-[#1b0f08] transition hover:brightness-105 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="truncate">
                  {needsSecondFlavor ? "Escolha o segundo sabor" : "Continuar"}
                </span>
                {!needsSecondFlavor && (
                  <ChevronRight className="size-4 shrink-0" strokeWidth={2.5} />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={addToCart}
                className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-2xl bg-primary px-4 text-[15px] font-semibold text-[#1b0f08] transition hover:brightness-105 active:scale-[.98]"
              >
                <span className="truncate">Adicionar ao carrinho</span>
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
