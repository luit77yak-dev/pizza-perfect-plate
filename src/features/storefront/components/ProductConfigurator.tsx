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
    <div
      className="ppp-order-builder fixed inset-0 z-[120] flex items-end justify-center bg-foreground/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={"Montar " + product.name}
    >
      <div className="flex h-[96dvh] max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[2rem] border border-border/70 bg-background shadow-[0_28px_90px_rgba(0,0,0,.38)] sm:h-[92vh] sm:max-h-[92vh] sm:rounded-[2rem]">
        <header className="relative shrink-0 border-b bg-background">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <div className="size-12 shrink-0 overflow-hidden rounded-2xl bg-muted sm:size-14">
              {product.image_url ? (
                <img src={product.image_url} alt="" className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-primary/50">
                  <Pizza className="size-6" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-[.2em] text-primary">
                Personalizar pedido
              </p>
              <div className="flex items-center gap-2">
                <h2 className="truncate font-display text-xl tracking-[-.03em] sm:text-2xl">
                  {product.name}
                </h2>
                <span className="hidden rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-primary sm:inline-flex">
                  {step}/{totalSteps}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Fechar"
              className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="grid grid-cols-3 border-t bg-muted/30">
            {["Escolha", "Personalize", "Finalize"].map((label, index) => {
              const itemStep = index + 1;
              const active = itemStep === step;
              const complete = itemStep < step;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => itemStep <= step && setStep(itemStep)}
                  className={
                    "relative flex items-center justify-center gap-2 px-2 py-2.5 text-[9px] font-bold uppercase tracking-[.13em] transition " +
                    (active
                      ? "text-primary"
                      : complete
                        ? "text-foreground"
                        : "text-muted-foreground")
                  }
                >
                  <span
                    className={
                      "grid size-5 place-items-center rounded-full border text-[8px] " +
                      (active
                        ? "border-primary bg-primary text-primary-foreground"
                        : complete
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground")
                    }
                  >
                    {complete ? <Check className="size-3" /> : itemStep}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                  {active && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid min-h-full max-w-5xl lg:grid-cols-[minmax(260px,.72fr)_minmax(0,1.28fr)]">
            <aside className="hidden border-r bg-muted/20 p-6 lg:block">
              <div className="sticky top-0">
                <div className="overflow-hidden rounded-[1.75rem] border bg-card shadow-sm">
                  <div className="aspect-square overflow-hidden bg-muted">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="size-full object-cover transition-transform duration-500 hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="grid size-full place-items-center text-primary/30">
                        <Pizza className="size-20" />
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <p className="text-[9px] font-bold uppercase tracking-[.18em] text-primary">
                      Sua escolha
                    </p>
                    <h3 className="mt-1 font-display text-2xl tracking-tight">{product.name}</h3>
                    {product.description && (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {product.description}
                      </p>
                    )}
                    <div className="mt-5 flex items-end justify-between border-t pt-4">
                      <span className="text-xs text-muted-foreground">
                        {selectedSize?.name ?? "Escolha um tamanho"}
                      </span>
                      <span className="text-lg font-black">
                        {formatCurrency(unitPrice * quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            <main className="min-w-0 px-4 py-5 sm:px-6 sm:py-6">
              {step === 1 && (
                <section className="space-y-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
                      Comece por aqui
                    </p>
                    <h3 className="mt-1 font-display text-2xl tracking-tight sm:text-3xl">
                      Monte sua pizza
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Escolha o tamanho e, se quiser, combine dois sabores.
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] border bg-card p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">
                          01 · Tamanho
                        </p>
                        <p className="mt-1 text-base font-bold">Qual vai ser o tamanho?</p>
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {selectedSize?.name ?? "Selecione"}
                      </span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {data.sizes.map((size, index) => {
                        const price = getPrice(product, size.id, data.prices);
                        const selected = sizeId === size.id;
                        return (
                          <button
                            key={size.id}
                            type="button"
                            onClick={() => setSizeId(size.id)}
                            className={
                              "relative flex min-h-16 items-center gap-3 rounded-2xl border p-3 text-left transition-all " +
                              (selected
                                ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_24px_hsl(var(--primary)/.16)]"
                                : "bg-background hover:border-primary/40 hover:bg-primary/[.03]")
                            }
                          >
                            <div
                              className={
                                "grid size-10 shrink-0 place-items-center rounded-xl border " +
                                (selected
                                  ? "border-primary-foreground/20 bg-primary-foreground/10"
                                  : "border-border bg-muted")
                              }
                            >
                              <Pizza className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold">{size.name}</p>
                              {size.slices ? (
                                <p
                                  className={
                                    "text-[11px] " +
                                    (selected
                                      ? "text-primary-foreground/70"
                                      : "text-muted-foreground")
                                  }
                                >
                                  {size.slices} fatias
                                </p>
                              ) : null}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black">{formatCurrency(price)}</p>
                              {selected && (
                                <p className="text-[8px] font-bold uppercase tracking-widest opacity-70">
                                  Escolhido
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {product.allow_half && (
                    <div className="rounded-[1.5rem] border bg-card p-4 sm:p-5">
                      <div className="mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">
                          02 · Sabor
                        </p>
                        <p className="mt-1 text-base font-bold">Como você quer sua pizza?</p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => {
                            setHalfMode(false);
                            setSecondProductId(null);
                          }}
                          className={
                            "rounded-2xl border p-4 text-left transition-all " +
                            (!halfMode
                              ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_22px_hsl(var(--primary)/.15)]"
                              : "bg-background hover:border-primary/40")
                          }
                        >
                          <div className="flex items-center justify-between">
                            <div
                              className={
                                "grid size-10 place-items-center rounded-xl border " +
                                (!halfMode
                                  ? "border-primary-foreground/20 bg-primary-foreground/10"
                                  : "border-border bg-muted")
                              }
                            >
                              <Pizza className="size-5" />
                            </div>
                            {!halfMode && (
                              <span className="text-[8px] font-bold uppercase tracking-widest opacity-80">
                                Selecionado
                              </span>
                            )}
                          </div>
                          <p className="mt-3 font-bold">Pizza inteira</p>
                          <p
                            className={
                              "mt-1 text-xs " +
                              (!halfMode
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground")
                            }
                          >
                            Um único sabor
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setHalfMode(true)}
                          className={
                            "rounded-2xl border p-4 text-left transition-all " +
                            (halfMode
                              ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_22px_hsl(var(--primary)/.15)]"
                              : "bg-background hover:border-primary/40")
                          }
                        >
                          <div className="flex items-center justify-between">
                            <div
                              className={
                                "relative grid size-10 place-items-center overflow-hidden rounded-xl border " +
                                (halfMode
                                  ? "border-primary-foreground/20 bg-primary-foreground/10"
                                  : "border-border bg-muted")
                              }
                            >
                              <span className="absolute inset-y-0 left-0 w-1/2 bg-primary/20" />
                              <span className="absolute inset-y-0 right-0 w-1/2 bg-primary/40" />
                              <span className="relative text-sm font-black">½</span>
                            </div>
                            {halfMode && (
                              <span className="text-[8px] font-bold uppercase tracking-widest opacity-80">
                                Selecionado
                              </span>
                            )}
                          </div>
                          <p className="mt-3 font-bold">Meio a meio</p>
                          <p
                            className={
                              "mt-1 text-xs " +
                              (halfMode ? "text-primary-foreground/70" : "text-muted-foreground")
                            }
                          >
                            Dois sabores na mesma pizza
                          </p>
                        </button>
                      </div>

                      {halfMode && (
                        <div
                          ref={personalizationScrollRef}
                          className="mt-3 rounded-2xl border border-primary/20 bg-primary/[.04] p-4"
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold">Escolha o segundo sabor</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Primeira metade: <strong>{product.name}</strong>
                              </p>
                            </div>
                            {secondProduct && (
                              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-bold text-primary">
                                2 sabores
                              </span>
                            )}
                          </div>

                          <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
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
                                      "flex items-center gap-3 rounded-xl border p-3 text-left transition " +
                                      (selected
                                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                                        : "bg-background hover:border-primary/40")
                                    }
                                  >
                                    <div className="size-11 shrink-0 overflow-hidden rounded-xl bg-muted">
                                      {item.image_url ? (
                                        <img
                                          src={item.image_url}
                                          alt=""
                                          className="size-full object-cover"
                                        />
                                      ) : (
                                        <div className="grid size-full place-items-center text-primary/40">
                                          <Pizza className="size-5" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold">{item.name}</p>
                                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                                        {formatCurrency(price)} · segunda metade
                                      </p>
                                    </div>
                                    <span className="text-xs font-black">
                                      {formatCurrency(previewPrice)}
                                    </span>
                                  </button>
                                );
                              })}
                          </div>

                          {secondProduct && (
                            <div className="mt-3 flex items-center gap-3 rounded-xl bg-background p-3">
                              <div className="relative size-10 shrink-0 overflow-hidden rounded-full border bg-muted">
                                {secondProduct.image_url ? (
                                  <img
                                    src={secondProduct.image_url}
                                    alt=""
                                    className="size-full object-cover"
                                  />
                                ) : (
                                  <div className="grid size-full place-items-center text-primary/40">
                                    <Pizza className="size-4" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-primary">
                                  Pizza montada
                                </p>
                                <p className="truncate text-sm font-bold">
                                  ½ {product.name} · ½ {secondProduct.name}
                                </p>
                              </div>
                              <span className="text-sm font-black">
                                {formatCurrency(halfBasePrice)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {step === 2 && (
                <section className="space-y-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
                      Ajuste os detalhes
                    </p>
                    <h3 className="mt-1 font-display text-2xl tracking-tight sm:text-3xl">
                      Do seu jeito
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Escolha borda, adicionais e deixe uma observação se precisar.
                    </p>
                  </div>

                  {data.crusts.length > 0 && (
                    <div className="rounded-[1.5rem] border bg-card p-4 sm:p-5">
                      <div className="mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">
                          Borda
                        </p>
                        <p className="mt-1 text-base font-bold">Escolha sua borda</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {data.crusts.map((item) => {
                          const selected = crustId === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setCrustId(selected ? null : item.id)}
                              className={
                                "flex items-center gap-3 rounded-xl border p-3 text-left transition " +
                                (selected
                                  ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                                  : "bg-background hover:border-primary/40")
                              }
                            >
                              <span
                                className={
                                  "grid size-8 shrink-0 place-items-center rounded-full border " +
                                  (selected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border")
                                }
                              >
                                {selected ? <Check className="size-3.5" /> : null}
                              </span>
                              <span className="min-w-0 flex-1 text-sm font-semibold">
                                {item.name}
                              </span>
                              <span className="text-xs font-bold">
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
                    <div className="rounded-[1.5rem] border bg-card p-4 sm:p-5">
                      <div className="mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">
                          Adicionais
                        </p>
                        <p className="mt-1 text-base font-bold">Quer acrescentar algo?</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {availableAddons.map((item) => {
                          const checked = addonIds.includes(item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleAddon(item.id)}
                              className={
                                "flex items-center gap-3 rounded-xl border p-3 text-left transition " +
                                (checked
                                  ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                                  : "bg-background hover:border-primary/40")
                              }
                            >
                              <span
                                className={
                                  "grid size-7 shrink-0 place-items-center rounded-full border " +
                                  (checked
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border")
                                }
                              >
                                {checked ? <Check className="size-3.5" /> : null}
                              </span>
                              <span className="min-w-0 flex-1 text-sm font-semibold">
                                {item.name}
                              </span>
                              <span className="text-xs font-bold">
                                +{formatCurrency(Number(item.price))}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="rounded-[1.5rem] border bg-card p-4 sm:p-5">
                    <label htmlFor="product-notes" className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">
                      Observação
                    </label>
                    <Textarea
                      id="product-notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      className="mt-3 min-h-24 rounded-xl"
                      placeholder="Ex.: sem cebola, pouco molho..."
                      maxLength={300}
                    />
                  </div>
                </section>
              )}

              {step === 3 && (
                <section className="space-y-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
                      Opcional
                    </p>
                    <h3 className="mt-1 font-display text-2xl tracking-tight sm:text-3xl">
                      Complete seu pedido
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Bebidas, doces e acompanhamentos entram como complementos.
                    </p>
                  </div>

                  {comboProducts.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {comboProducts.map((item) => {
                        const checked = comboProductIds.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleCombo(item.id)}
                            className={
                              "flex items-center gap-3 rounded-2xl border p-3 text-left transition " +
                              (checked
                                ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                                : "bg-card hover:border-primary/40")
                            }
                          >
                            <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                              {item.image_url ? (
                                <img src={item.image_url} alt="" className="size-full object-cover" />
                              ) : (
                                <div className="grid size-full place-items-center font-display text-lg text-primary/40">
                                  {item.name.charAt(0)}
                                </div>
                              )}
                            </div>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold">{item.name}</span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                Adicionar ao pedido
                              </span>
                            </span>
                            <span className="shrink-0 text-sm font-black">
                              {formatCurrency(Number(item.base_price) || 0)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Nenhum complemento disponível no momento.
                    </div>
                  )}

                  <div className="rounded-[1.5rem] border bg-muted/40 p-4 sm:p-5">
                    <p className="text-[9px] font-bold uppercase tracking-[.18em] text-primary">
                      Resumo do item
                    </p>
                    <div className="mt-3 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-bold">
                          {product.name}
                          {secondProduct ? " + " + secondProduct.name : ""}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {selectedSize?.name ?? "Sem tamanho"}
                          {crust ? " · " + crust.name : ""}
                          {addons.length ? " · " + addons.length + " adicional(is)" : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-lg font-black">
                        {formatCurrency(unitPrice * quantity)}
                      </p>
                    </div>
                    {comboProductIds.length > 0 && (
                      <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                        + {comboProductIds.length} complemento(s) serão adicionados ao carrinho.
                      </p>
                    )}
                  </div>
                </section>
              )}
            </main>
          </div>
        </div>

        <footer className="relative z-20 shrink-0 border-t bg-background px-4 pb-[calc(.65rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_rgba(0,0,0,.10)] sm:px-6 sm:py-3">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <div className="hidden min-w-0 flex-1 sm:block">
              <p className="text-[9px] font-bold uppercase tracking-[.16em] text-muted-foreground">
                {quantity} {quantity === 1 ? "pizza" : "pizzas"} · {selectedSize?.name ?? "tamanho"}
              </p>
              <p className="truncate text-sm font-bold">
                {product.name}
                {secondProduct ? " · meio a meio" : ""}
              </p>
            </div>

            <div className="mr-auto sm:mr-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Total
              </p>
              <p className="text-lg font-black tracking-tight">
                {formatCurrency(unitPrice * quantity)}
              </p>
            </div>

            <button
              type="button"
              onClick={step > 1 ? previousStep : onClose}
              className="h-11 rounded-full border border-foreground bg-foreground px-5 text-xs font-bold text-background transition hover:bg-foreground/90 active:scale-[.98]"
            >
              {step > 1 ? "Voltar" : "Cancelar"}
            </button>

            {step < totalSteps ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={step === 1 && product.allow_half && halfMode && !secondProductId}
                className="flex h-11 min-w-32 items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-primary-foreground shadow-[0_8px_20px_hsl(var(--primary)/.18)] transition hover:brightness-105 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  {step === 1 && product.allow_half && halfMode && !secondProductId
                    ? "Escolha o segundo sabor"
                    : "Continuar"}
                </span>
                {!(step === 1 && product.allow_half && halfMode && !secondProductId) && (
                  <ChevronRight className="size-4" />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={addToCart}
                className="h-11 min-w-44 rounded-full bg-primary px-5 text-xs font-bold text-primary-foreground shadow-[0_8px_20px_hsl(var(--primary)/.18)] transition hover:brightness-105 active:scale-[.98]"
              >
                Adicionar · {formatCurrency(unitPrice * quantity)}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
