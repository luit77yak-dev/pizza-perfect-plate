            </section>
          )}
        </div>

        <div className="relative z-20 shrink-0 border-t-2 border-primary/10 bg-card px-3 pb-[calc(.65rem+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-12px_30px_rgba(0,0,0,.16)] sm:px-5 sm:py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground shadow-sm">{quantity} {quantity === 1 ? "pizza" : "pizzas"}</span>
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{step < totalSteps ? "Seu pedido" : "Total"}</span>
              <span className="whitespace-nowrap text-base font-black tracking-tight text-foreground">{formatCurrency(unitPrice * quantity)}</span>
            </div>
          </div>
          <div className="grid grid-cols-[minmax(92px,.72fr)_minmax(0,1.28fr)] gap-2 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-3">
            <button
              type="button"
              onClick={step > 1 ? previousStep : onClose}
              className="flex h-12 min-w-0 items-center justify-center rounded-full border border-foreground bg-foreground px-3 text-sm font-semibold text-background shadow-sm transition active:scale-[.98] hover:bg-foreground/90"
            >
              {step > 1 ? "Voltar" : "Cancelar"}
            </button>
            {step < totalSteps ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={step === 1 && product.allow_half && halfMode && !secondProductId}
                className="flex h-12 min-w-0 items-center justify-center gap-1 overflow-hidden rounded-full bg-primary px-3 text-sm font-bold text-primary-foreground shadow-[0_8px_20px_hsl(var(--primary)/.2)] transition active:scale-[.98] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
              >
                <span className="min-w-0 truncate">
                  {step === 1 && product.allow_half && halfMode && !secondProductId ? "Escolha o segundo sabor" : "Próxima etapa"}
                </span>
                {!(step === 1 && product.allow_half && halfMode && !secondProductId) && <ChevronRight className="size-4 shrink-0" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={addToCart}
                className="flex h-12 min-w-0 items-center justify-center overflow-hidden rounded-full bg-primary px-2.5 text-sm font-bold text-primary-foreground shadow-[0_8px_20px_hsl(var(--primary)/.2)] transition active:scale-[.98] hover:brightness-105 sm:px-5"
              >
                <span className="min-w-0 truncate">Adicionar · {formatCurrency(unitPrice * quantity)}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );