<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Scope customer-store visual themes under `.ppp-customer-shell`; this preserves white-label styling without leaking into the administrative panel.
- The public storefront reads and writes through `src/integrations/storefront-backend/client.ts` (the external backend that owns the domain/instance catalog); preview and localhost hosts fall back to the food.neroxa.ia.br store so the preview matches production.
