import { useState } from "react";
import type { DemoState, DemoProduct, DemoGroup, DemoOption } from "./data/model";
import {
  productSchema,
  groupSchema,
  optionSchema,
  imageSchema,
  removeGroup,
  replaceGroup,
  removeProduct,
  createInitialState,
} from "./data/model";
import { demoStyle } from "./data/catalog-adapter";

type Props = {
  state: DemoState;
  update: (fn: (s: DemoState) => DemoState) => DemoState;
  notify: (message: string) => void;
};
const uid = () => crypto.randomUUID();
export function DemoImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [error, setError] = useState("");
  return (
    <div className="demo-image-field">
      <label>
        {label}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              if (
                file.size > 200000 ||
                !["image/png", "image/jpeg", "image/webp"].includes(file.type)
              )
                throw Error("Use PNG, JPEG ou WebP até 200 KB.");
              const data = await new Promise<string>((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(String(r.result));
                r.onerror = reject;
                r.readAsDataURL(file);
              });
              onChange(imageSchema.parse(data));
              setError("");
            } catch {
              setError("Use PNG, JPEG ou WebP local até 200 KB.");
            }
          }}
        />
      </label>
      {value && (
        <>
          <img src={value} alt={`Prévia: ${label}`} />
          <button type="button" className="forno-secondary-button" onClick={() => onChange("")}>
            Remover {label.toLowerCase()}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
function BlankProduct(categoryId: string): DemoProduct {
  return {
    id: uid(),
    name: "",
    description: "",
    price: 0,
    image: "",
    categoryId,
    kind: "PIZZA",
    active: true,
    available: true,
    allowHalf: true,
    halfRule: "highest_half",
    halfFixedPrice: 40,
    sort: 0,
  };
}
export function DemoCatalogManager({ state, update, notify }: Props) {
  const [draft, setDraft] = useState<DemoProduct | null>(null),
    [group, setGroup] = useState<DemoGroup | null>(null),
    [option, setOption] = useState<DemoOption | null>(null),
    [category, setCategory] = useState<DemoState["categories"][number] | null>(null),
    [error, setError] = useState("");
  const attempt = (fn: () => void) => {
    try {
      fn();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Configuração inválida.");
    }
  };
  const saveProduct = () =>
    attempt(() => {
      const p = productSchema.parse(draft);
      update((s) => ({
        ...s,
        products: s.products.some((v) => v.id === p.id)
          ? s.products.map((v) => (v.id === p.id ? p : v))
          : [...s.products, p],
      }));
      setDraft(null);
      notify("Produto atualizado na demonstração.");
    });
  const saveGroup = () =>
    attempt(() => {
      const g = groupSchema.parse(group);
      update((s) => replaceGroup(s, g));
      setGroup(null);
      setOption(null);
      notify("Grupo atualizado na demonstração.");
    });
  return (
    <section className="demo-management" aria-label="Gerenciar catálogo">
      <div className="forno-section-heading">
        <div>
          <span className="forno-eyebrow">CARDÁPIO COMPARTILHADO</span>
          <h2>Sabores da casa</h2>
        </div>
        <button
          className="forno-primary-button"
          onClick={() => {
            setDraft(BlankProduct(state.categories[0]!.id));
            setError("");
          }}
        >
          Novo produto
        </button>
      </div>
      <p className="forno-help">
        Produtos, bebidas e grupos são compartilhados com o cardápio nesta origem. Use apenas dados
        fictícios. Tamanhos e bordas cobram acréscimos ao preço base; combos usam o preço atual da
        bebida e do volume.
      </p>
      {error && (
        <p role="alert" className="forno-help">
          {error}
        </p>
      )}
      {draft && (
        <form
          className="demo-editor"
          aria-label="Editar produto"
          onSubmit={(e) => {
            e.preventDefault();
            saveProduct();
          }}
        >
          <h3>
            {state.products.some((p) => p.id === draft.id) ? "Editar produto" : "Cadastrar produto"}
          </h3>
          <label>
            Nome do produto
            <input
              required
              maxLength={100}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            Descrição do produto
            <textarea
              aria-label="Descrição do produto"
              maxLength={1000}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
          <label>
            Preço base (R$)
            <input
              type="number"
              min="0"
              max="9999"
              step="0.01"
              required
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.valueAsNumber })}
            />
          </label>
          <label>
            Categoria
            <select
              aria-label="Categoria"
              value={draft.categoryId}
              onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
            >
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo de produto
            <select
              aria-label="Tipo de produto"
              value={draft.kind}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  kind: e.target.value as DemoProduct["kind"],
                  allowHalf: e.target.value === "PIZZA",
                })
              }
            >
              <option value="PIZZA">Pizza</option>
              <option value="DRINK">Bebida</option>
              <option value="SIMPLE">Produto simples</option>
              <option value="COMBO">Combo</option>
            </select>
          </label>
          <label>
            Ordem do produto
            <input
              type="number"
              min="0"
              max="999"
              value={draft.sort}
              onChange={(e) => setDraft({ ...draft, sort: e.target.valueAsNumber })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Produto ativo
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.available}
              onChange={(e) => setDraft({ ...draft, available: e.target.checked })}
            />
            Produto disponível
          </label>
          {draft.kind === "PIZZA" && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={draft.allowHalf}
                  onChange={(e) => setDraft({ ...draft, allowHalf: e.target.checked })}
                />
                Permitir meio a meio
              </label>
              <label>
                Preço meio a meio
                <select
                  aria-label="Preço meio a meio"
                  value={draft.halfRule}
                  onChange={(e) =>
                    setDraft({ ...draft, halfRule: e.target.value as DemoProduct["halfRule"] })
                  }
                >
                  <option value="highest_half">Maior metade</option>
                  <option value="average_halves">Média das metades</option>
                  <option value="fixed_price">Preço fixo</option>
                </select>
              </label>
              {draft.halfRule === "fixed_price" && (
                <label>
                  Preço fixo meio a meio
                  <input
                    type="number"
                    min="0"
                    max="9999"
                    step="0.01"
                    value={draft.halfFixedPrice}
                    onChange={(e) => setDraft({ ...draft, halfFixedPrice: e.target.valueAsNumber })}
                  />
                </label>
              )}
            </>
          )}
          <DemoImageField
            label="Imagem do produto"
            value={draft.image}
            onChange={(v) => setDraft((current) => (current ? { ...current, image: v } : null))}
          />
          <div className="demo-actions">
            <button className="forno-primary-button" type="submit">
              Salvar produto
            </button>
            <button className="forno-secondary-button" type="button" onClick={() => setDraft(null)}>
              Cancelar produto
            </button>
          </div>
        </form>
      )}
      <div className="forno-grid">
        {state.products.map((p) => (
          <article className="forno-product" key={p.id}>
            {p.image && <img className="demo-thumbnail" src={p.image} alt="" />}
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <strong>
              R$ {p.price.toFixed(2)} · {p.active && p.available ? "Disponível" : "Indisponível"}
            </strong>
            <div className="demo-actions">
              <button
                className="forno-secondary-button"
                aria-label={`Editar produto ${p.name}`}
                onClick={() => {
                  setDraft(p);
                  setError("");
                }}
              >
                Editar
              </button>
              <button
                className="forno-secondary-button"
                aria-label={`Excluir produto ${p.name}`}
                onClick={() =>
                  attempt(() => {
                    update((s) => removeProduct(s, p.id));
                    notify("Produto excluído da demonstração.");
                  })
                }
              >
                Excluir
              </button>
              <button
                className="forno-secondary-button"
                aria-label={`${p.active ? "Desativar" : "Ativar"} produto ${p.name}`}
                onClick={() =>
                  attempt(() => {
                    update((s) => ({
                      ...s,
                      products: s.products.map((v) =>
                        v.id === p.id ? { ...v, active: !v.active } : v,
                      ),
                    }));
                    notify("Disponibilidade atualizada.");
                  })
                }
              >
                {p.active ? "Desativar" : "Ativar"}
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="forno-section-heading">
        <h2>Categorias</h2>
        <button
          className="forno-secondary-button"
          onClick={() =>
            setCategory({ id: uid(), name: "", active: true, sort: state.categories.length })
          }
        >
          Nova categoria
        </button>
      </div>
      {category && (
        <form
          className="demo-editor"
          aria-label="Editar categoria"
          onSubmit={(e) => {
            e.preventDefault();
            attempt(() => {
              update((s) => ({
                ...s,
                categories: s.categories.some((c) => c.id === category.id)
                  ? s.categories.map((c) => (c.id === category.id ? category : c))
                  : [...s.categories, category],
              }));
              setCategory(null);
              notify("Categoria atualizada.");
            });
          }}
        >
          <label>
            Nome da categoria
            <input
              required
              maxLength={100}
              value={category.name}
              onChange={(e) => setCategory({ ...category, name: e.target.value })}
            />
          </label>
          <label>
            Ordem da categoria
            <input
              type="number"
              min="0"
              max="999"
              value={category.sort}
              onChange={(e) => setCategory({ ...category, sort: e.target.valueAsNumber })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={category.active}
              onChange={(e) => setCategory({ ...category, active: e.target.checked })}
            />
            Categoria ativa
          </label>
          <div className="demo-actions">
            <button className="forno-primary-button">Salvar categoria</button>
            <button
              type="button"
              className="forno-secondary-button"
              onClick={() => setCategory(null)}
            >
              Cancelar categoria
            </button>
          </div>
        </form>
      )}
      <div className="demo-list">
        {state.categories.map((c) => (
          <article key={c.id}>
            <strong>
              {c.name} · ordem {c.sort} · {c.active ? "Ativa" : "Inativa"}
            </strong>
            <div className="demo-actions">
              <button
                className="forno-secondary-button"
                aria-label={`Editar categoria ${c.name}`}
                onClick={() => setCategory(c)}
              >
                Editar
              </button>
              <button
                className="forno-secondary-button"
                aria-label={`Excluir categoria ${c.name}`}
                onClick={() =>
                  attempt(() => {
                    if (state.products.some((p) => p.categoryId === c.id))
                      throw Error("Mova os produtos antes de excluir a categoria.");
                    update((s) => ({
                      ...s,
                      categories: s.categories.filter((v) => v.id !== c.id),
                      groups: s.groups.map((g) => ({
                        ...g,
                        categoryIds: g.categoryIds.filter((v) => v !== c.id),
                      })),
                    }));
                    notify("Categoria excluída.");
                  })
                }
              >
                Excluir
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="forno-section-heading">
        <h2>Grupos e complementos</h2>
        <button
          className="forno-primary-button"
          onClick={() => {
            setGroup({
              id: uid(),
              name: "",
              kind: "ADDON",
              active: true,
              min: 0,
              max: 3,
              productIds: [],
              categoryIds: [],
              options: [],
            });
            setOption(null);
            setError("");
          }}
        >
          Novo grupo
        </button>
      </div>
      {group && (
        <form
          className="demo-editor"
          aria-label="Editar grupo"
          onSubmit={(e) => {
            e.preventDefault();
            saveGroup();
          }}
        >
          <h3>Grupo reutilizável</h3>
          <label>
            Nome do grupo
            <input
              required
              value={group.name}
              maxLength={100}
              onChange={(e) => setGroup({ ...group, name: e.target.value })}
            />
          </label>
          <label>
            Tipo de grupo
            <select
              aria-label="Tipo de grupo"
              value={group.kind}
              onChange={(e) =>
                setGroup({
                  ...group,
                  kind: e.target.value as DemoGroup["kind"],
                  max: e.target.value === "ADDON" || e.target.value === "COMBO" ? group.max : 1,
                  options: [],
                })
              }
            >
              <option value="ADDON">Adicionais</option>
              <option value="SIZE">Tamanhos / volumes</option>
              <option value="CRUST">Bordas</option>
              <option value="FLAVOR">Sabores meio a meio</option>
              <option value="COMBO">Bebidas no combo</option>
            </select>
          </label>
          <p className="forno-help">
            Alterar o tipo limpa as opções deste rascunho. Mínimo 0 = opcional; mínimo 1 ou mais =
            obrigatório.
          </p>
          <label>
            Seleção mínima
            <input
              type="number"
              min="0"
              max="20"
              value={group.min}
              onChange={(e) => setGroup({ ...group, min: e.target.valueAsNumber })}
            />
          </label>
          <label>
            Seleção máxima
            <input
              type="number"
              min="1"
              max="20"
              value={group.max}
              onChange={(e) => setGroup({ ...group, max: e.target.valueAsNumber })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={group.active}
              onChange={(e) => setGroup({ ...group, active: e.target.checked })}
            />
            Grupo ativo
          </label>
          <fieldset>
            <legend>Aplicar às categorias</legend>
            {state.categories.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={group.categoryIds.includes(c.id)}
                  onChange={(e) =>
                    setGroup({
                      ...group,
                      categoryIds: e.target.checked
                        ? [...group.categoryIds, c.id]
                        : group.categoryIds.filter((v) => v !== c.id),
                    })
                  }
                />
                {c.name}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Aplicar aos produtos</legend>
            {state.products.map((p) => (
              <label key={p.id}>
                <input
                  type="checkbox"
                  checked={group.productIds.includes(p.id)}
                  onChange={(e) =>
                    setGroup({
                      ...group,
                      productIds: e.target.checked
                        ? [...group.productIds, p.id]
                        : group.productIds.filter((v) => v !== p.id),
                    })
                  }
                />
                {p.name}
              </label>
            ))}
          </fieldset>
          <h4>Opções do grupo</h4>
          {group.options.map((o) => (
            <div className="demo-option-row" key={o.id}>
              <strong>
                {o.name} · R$ {o.price.toFixed(2)} · {o.active ? "Ativa" : "Inativa"}
              </strong>
              <button
                className="forno-secondary-button"
                type="button"
                aria-label={`Editar opção ${o.name}`}
                onClick={() => setOption(o)}
              >
                Editar
              </button>
              <button
                className="forno-secondary-button"
                type="button"
                aria-label={`Excluir opção ${o.name}`}
                onClick={() => {
                  setGroup({ ...group, options: group.options.filter((v) => v.id !== o.id) });
                  setOption(null);
                }}
              >
                Excluir
              </button>
            </div>
          ))}
          <button
            className="forno-secondary-button"
            type="button"
            onClick={() =>
              setOption({
                id: uid(),
                name: "",
                description: "",
                price: 0,
                image: "",
                active: true,
                productId: null,
                variantId: null,
              })
            }
          >
            Nova opção
          </button>
          {option && (
            <fieldset className="demo-option-editor">
              <legend>Editar complemento</legend>
              <label>
                Nome da opção
                <input
                  value={option.name}
                  maxLength={100}
                  onChange={(e) => setOption({ ...option, name: e.target.value })}
                />
              </label>
              <label>
                Descrição da opção
                <textarea
                  value={option.description}
                  maxLength={1000}
                  onChange={(e) => setOption({ ...option, description: e.target.value })}
                />
              </label>
              <label>
                Preço / acréscimo da opção (R$)
                <input
                  type="number"
                  min="0"
                  max="9999"
                  step="0.01"
                  value={option.price}
                  onChange={(e) => setOption({ ...option, price: e.target.valueAsNumber })}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={option.active}
                  onChange={(e) => setOption({ ...option, active: e.target.checked })}
                />
                Opção ativa
              </label>
              {["FLAVOR", "COMBO"].includes(group.kind) && (
                <>
                  <label>
                    Produto da opção
                    <select
                      aria-label="Produto da opção"
                      value={option.productId ?? ""}
                      onChange={(e) =>
                        setOption({ ...option, productId: e.target.value || null, variantId: null })
                      }
                    >
                      <option value="">Selecione</option>
                      {state.products
                        .filter((p) => p.kind === (group.kind === "FLAVOR" ? "PIZZA" : "DRINK"))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <p className="forno-help">
                    O preço vem do produto referenciado; o acréscimo acima é ignorado para sabores e
                    combos.
                  </p>
                  {group.kind === "COMBO" && (
                    <label>
                      Volume no combo
                      <select
                        aria-label="Volume no combo"
                        value={option.variantId ?? ""}
                        onChange={(e) =>
                          setOption({ ...option, variantId: e.target.value || null })
                        }
                      >
                        <option value="">Preço base da bebida</option>
                        {state.groups
                          .filter(
                            (g) =>
                              g.kind === "SIZE" &&
                              (g.productIds.includes(option.productId ?? "") ||
                                g.categoryIds.includes(
                                  state.products.find((p) => p.id === option.productId)
                                    ?.categoryId ?? "",
                                )),
                          )
                          .flatMap((g) => g.options)
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                </>
              )}
              <DemoImageField
                label="Imagem da opção"
                value={option.image}
                onChange={(v) => setOption((c) => (c ? { ...c, image: v } : null))}
              />
              <button
                className="forno-secondary-button"
                type="button"
                onClick={() =>
                  attempt(() => {
                    const o = optionSchema.parse(option);
                    setGroup({
                      ...group,
                      options: group.options.some((v) => v.id === o.id)
                        ? group.options.map((v) => (v.id === o.id ? o : v))
                        : [...group.options, o],
                    });
                    setOption(null);
                  })
                }
              >
                Aplicar opção ao rascunho
              </button>
              <button
                className="forno-secondary-button"
                type="button"
                onClick={() => setOption(null)}
              >
                Cancelar opção
              </button>
            </fieldset>
          )}
          <div className="demo-actions">
            <button className="forno-primary-button" type="submit" disabled={Boolean(option)}>
              Salvar grupo
            </button>
            <button
              className="forno-secondary-button"
              type="button"
              onClick={() => {
                setGroup(null);
                setOption(null);
              }}
            >
              Cancelar grupo
            </button>
          </div>
        </form>
      )}
      <div className="demo-list">
        {state.groups.map((g) => (
          <article key={g.id}>
            <strong>
              {g.name} · {g.kind} · {g.min}–{g.max} · {g.active ? "Ativo" : "Inativo"}
            </strong>
            <p>
              {g.options.length} opções · {g.productIds.length} produtos / {g.categoryIds.length}{" "}
              categorias
            </p>
            <div className="demo-actions">
              <button
                className="forno-secondary-button"
                aria-label={`Editar grupo ${g.name}`}
                onClick={() => {
                  setGroup(g);
                  setOption(null);
                  setError("");
                }}
              >
                Editar
              </button>
              <button
                className="forno-secondary-button"
                aria-label={`Excluir grupo ${g.name}`}
                onClick={() =>
                  attempt(() => {
                    update((s) => removeGroup(s, g.id));
                    notify("Grupo excluído.");
                  })
                }
              >
                Excluir
              </button>
              <button
                className="forno-secondary-button"
                aria-label={`${g.active ? "Desativar" : "Ativar"} grupo ${g.name}`}
                onClick={() =>
                  attempt(() => {
                    update((s) => ({
                      ...s,
                      groups: s.groups.map((v) =>
                        v.id === g.id ? { ...v, active: !v.active } : v,
                      ),
                    }));
                    notify("Grupo atualizado.");
                  })
                }
              >
                {g.active ? "Desativar" : "Ativar"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
export function DemoStoreEditor({
  state,
  update,
  notify,
  appearance = false,
}: Props & { appearance?: boolean }) {
  const [draft, setDraft] = useState(state.store),
    [error, setError] = useState("");
  const save = () => {
    try {
      update((s) => ({
        ...s,
        store: appearance
          ? {
              ...s.store,
              logo: draft.logo,
              banner: draft.banner,
              background: draft.background,
              surface: draft.surface,
              foreground: draft.foreground,
              accent: draft.accent,
            }
          : {
              ...draft,
              background: s.store.background,
              surface: s.store.surface,
              foreground: s.store.foreground,
              accent: s.store.accent,
              banner: s.store.banner,
            },
      }));
      setError("");
      notify(
        appearance
          ? "Identidade demonstrativa atualizada."
          : "Dados demonstrativos da loja atualizados.",
      );
    } catch {
      setError("Revise os campos. Não foi possível salvar.");
    }
  };
  return (
    <section className="demo-management">
      <div className="forno-section-heading">
        <h2>{appearance ? "A essência da marca" : "Minha loja"}</h2>
        <a className="forno-secondary-button" href="/visual-demo/" target="_blank" rel="noreferrer">
          Ver cardápio
        </a>
      </div>
      <form
        className="demo-editor"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {appearance ? (
          <>
            <p className="forno-help">
              Prévia local; a identidade original continua disponível para restauração. Texto e
              destaque precisam de contraste mínimo 4,5:1 sobre fundo e superfícies.
            </p>
            {(
              [
                ["background", "Fundo"],
                ["surface", "Superfícies"],
                ["foreground", "Texto"],
                ["accent", "Destaque"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="color"
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              </label>
            ))}
            <DemoImageField
              label="Banner"
              value={draft.banner}
              onChange={(v) => setDraft((c) => ({ ...c, banner: v }))}
            />
          </>
        ) : (
          <>
            <label>
              Nome da loja
              <input
                required
                maxLength={100}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Descrição da loja
              <textarea
                aria-label="Descrição da loja"
                maxLength={1000}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
            <label>
              Contato fictício
              <input
                maxLength={100}
                value={draft.contact}
                onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
              />
            </label>
            <label>
              Endereço fictício
              <input
                maxLength={250}
                value={draft.address}
                onChange={(e) => setDraft({ ...draft, address: e.target.value })}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.open}
                onChange={(e) => setDraft({ ...draft, open: e.target.checked })}
              />
              Loja aberta (simulação)
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.delivery}
                onChange={(e) => setDraft({ ...draft, delivery: e.target.checked })}
              />
              Entrega demonstrativa
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.pickup}
                onChange={(e) => setDraft({ ...draft, pickup: e.target.checked })}
              />
              Retirada demonstrativa
            </label>
            <fieldset>
              <legend>Horários fictícios</legend>
              {draft.hours.map((h, i) => (
                <div className="demo-hours" key={h.weekday}>
                  <span>
                    {
                      ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][
                        h.weekday
                      ]
                    }
                  </span>
                  <label>
                    <input
                      type="checkbox"
                      checked={h.closed}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          hours: draft.hours.map((v, j) =>
                            i === j ? { ...v, closed: e.target.checked } : v,
                          ),
                        })
                      }
                    />
                    Fechado
                  </label>
                  <label>
                    Abertura {h.weekday}
                    <input
                      type="time"
                      value={h.opens}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          hours: draft.hours.map((v, j) =>
                            i === j ? { ...v, opens: e.target.value } : v,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Encerramento {h.weekday}
                    <input
                      type="time"
                      value={h.closes}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          hours: draft.hours.map((v, j) =>
                            i === j ? { ...v, closes: e.target.value } : v,
                          ),
                        })
                      }
                    />
                  </label>
                </div>
              ))}
            </fieldset>
          </>
        )}
        <DemoImageField
          label="Logo"
          value={draft.logo}
          onChange={(v) => setDraft((c) => ({ ...c, logo: v }))}
        />
        {error && <p role="alert">{error}</p>}
        <div className="demo-actions">
          <button className="forno-primary-button">
            {appearance ? "Salvar aparência" : "Salvar loja"}
          </button>
          {appearance && (
            <button
              className="forno-secondary-button"
              type="button"
              onClick={() => {
                const original = createInitialState().store;
                const next = {
                  ...draft,
                  logo: original.logo,
                  banner: original.banner,
                  background: original.background,
                  surface: original.surface,
                  foreground: original.foreground,
                  accent: original.accent,
                };
                setDraft(next);
                try {
                  update((s) => ({
                    ...s,
                    store: {
                      ...s.store,
                      ...Object.fromEntries(
                        ["logo", "banner", "background", "surface", "foreground", "accent"].map(
                          (k) => [k, next[k as keyof typeof next]],
                        ),
                      ),
                    },
                  }));
                  notify("Identidade original restaurada.");
                } catch {
                  setError("Não foi possível restaurar.");
                }
              }}
            >
              Restaurar identidade original
            </button>
          )}
        </div>
      </form>
      {appearance && (
        <div className="demo-appearance-preview" style={demoStyle({ ...state, store: draft })}>
          <h3>{draft.name}</h3>
          <p>Prévia da identidade</p>
          {draft.logo && <img src={draft.logo} alt="Logo demonstrativo" />}
          <span>Explorar o cardápio</span>
        </div>
      )}
    </section>
  );
}
