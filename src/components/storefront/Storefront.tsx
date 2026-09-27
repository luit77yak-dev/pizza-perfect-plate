            </section>
          )}
        </div>

        <div className="relative z-20 shrink-0 border-t border-primary/10 bg-card px-3 pb-[calc(.45rem+env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:py-2.5 shadow-[0_-8px_20px_rgba(0,0,0,.12)]">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-primary-foreground">{quantity} {quantity === 1 ? "pizza" : "pizzas"}</span>
            <div className="flex min-w-0 items-baseline gap-1.5">
              <span className="truncate text-[9px] uppercase tracking-wider text-muted-foreground">{step < totalSteps ? "Seu pedido" : "Total"}</span>
              <span className="whitespace-nowrap text-sm font-black tracking-tight text-foreground">{formatCurrency(unitPrice * quantity)}</span>
            </div>
          </div>
          <div className="grid grid-cols-[minmax(78px,.62fr)_minmax(0,1.38fr)] gap-1.5 sm:grid-cols-[100px_minmax(0,1fr)] sm:gap-2">
            <button
              type="button"
              onClick={step > 1 ? previousStep : onClose}
              className="flex h-10 min-w-0 items-center justify-center rounded-full border border-foreground bg-foreground px-2.5 text-xs font-semibold text-background shadow-sm transition active:scale-[.98] hover:bg-foreground/90"
            >
              {step > 1 ? "Voltar" : "Cancelar"}
            </button>
            {step < totalSteps ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={step === 1 && product.allow_half && halfMode && !secondProductId}
                className="flex h-10 min-w-0 items-center justify-center gap-1 overflow-hidden rounded-full bg-primary px-2.5 text-xs font-bold text-primary-foreground shadow-[0_6px_16px_hsl(var(--primary)/.18)] transition active:scale-[.98] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
              >
                <span className="min-w-0 truncate">
                  {step === 1 && product.allow_half && halfMode && !secondProductId ? "Escolha o segundo sabor" : "Próxima etapa"}
                </span>
                {!(step === 1 && product.allow_half && halfMode && !secondProductId) && <ChevronRight className="size-3.5 shrink-0" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={addToCart}
                className="flex h-10 min-w-0 items-center justify-center overflow-hidden rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground shadow-[0_6px_16px_hsl(var(--primary)/.18)] transition active:scale-[.98] hover:brightness-105 sm:px-4"
              >
                <span className="min-w-0 truncate">Adicionar · {formatCurrency(unitPrice * quantity)}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );