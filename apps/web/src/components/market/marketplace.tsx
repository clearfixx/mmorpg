'use client'

import { ArrowLeft, Clock, Coins, Package, ShoppingBag } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const endpoint =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql'

interface MarketItem {
  id: string
  name: string
  itemLevel: number
  rarity: string
  rollQuality: number
  damage: number
  armor: number
  health: number
  binding: string
  setName: string
}

interface Listing {
  id: string
  item: MarketItem | null
  resource: MarketResource | null
  price: number
  deposit: number
  minimumPrice: number
  referencePrice: number | null
  comparableSales: number
  status: string
  expiresAt: string
  createdAt: string
  own: boolean
}

interface HistoryEntry {
  id: string
  item: MarketItem | null
  resource: MarketResource | null
  price: number
  saleFee: number
  sellerProceeds: number
  status: string
  role: string
  completedAt: string
}

interface MarketResource {
  type: string
  name: string
  amount: number
  rarity: string
}

interface MarketplaceState {
  balance: number
  listingDeposit: number
  saleFeePercent: number
  page: number
  totalPages: number
  totalListings: number
  stats: {
    purchases: number
    sales: number
    spent: number
    earned: number
    feesPaid: number
  }
  listings: Listing[]
  myListings: Listing[]
  history: HistoryEntry[]
}

interface MarketQuote {
  minimumPrice: number
  referencePrice: number | null
  comparableSales: number
  saleFeePercent: number
  saleFeeAtReference: number
  proceedsAtReference: number
}

interface InventoryLike {
  chest: MarketItem[]
  backpack: MarketItem[]
}

const marketFields =
  'balance listingDeposit saleFeePercent page totalPages totalListings stats { purchases sales spent earned feesPaid } listings { id price deposit minimumPrice referencePrice comparableSales status expiresAt createdAt own item { id name itemLevel rarity rollQuality damage armor health binding setName } resource { type name amount rarity } } myListings { id price deposit minimumPrice referencePrice comparableSales status expiresAt createdAt own item { id name itemLevel rarity rollQuality damage armor health binding setName } resource { type name amount rarity } } history { id price saleFee sellerProceeds status role completedAt item { id name itemLevel rarity rollQuality damage armor health binding setName } resource { type name amount rarity } }'

export function Marketplace({
  inventory,
  resources,
  onBack,
}: {
  inventory: InventoryLike | null
  resources: Array<{ type: string; amount: number }>
  onBack: () => void
}) {
  const [market, setMarket] = useState<MarketplaceState | null>(null)
  const [selectedItemId, setSelectedItemId] = useState('')
  const [itemPrice, setItemPrice] = useState('1')
  const [resourcePrice, setResourcePrice] = useState('1')
  const [selectedResource, setSelectedResource] = useState('')
  const [resourceAmount, setResourceAmount] = useState('1')
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('ALL')
  const [sort, setSort] = useState('NEWEST')
  const [page, setPage] = useState(1)
  const [rarity, setRarity] = useState('ALL')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minLevel, setMinLevel] = useState('')
  const [maxLevel, setMaxLevel] = useState('')
  const [quote, setQuote] = useState<MarketQuote | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tradeableItems = useMemo(() => {
    const listed = new Set(
      market?.myListings.flatMap((listing) =>
        listing.item ? [listing.item.id] : [],
      ) ?? [],
    )
    return [...(inventory?.chest ?? []), ...(inventory?.backpack ?? [])].filter(
      (item) => item.binding !== 'BOUND' && !listed.has(item.id),
    )
  }, [inventory, market?.myListings])

  const load = useCallback(async () => {
    const data = await graphQl<{ marketplace: MarketplaceState }>(
      `query Market($input: MarketBrowseInput) { marketplace(input: $input) { ${marketFields} } }`,
      {
        input: browseInput({
          search,
          kind,
          sort,
          page,
          rarity,
          minPrice,
          maxPrice,
          minLevel,
          maxLevel,
        }),
      },
    )
    setMarket(data.marketplace)
  }, [kind, maxLevel, maxPrice, minLevel, minPrice, page, rarity, search, sort])

  useEffect(() => {
    let cancelled = false
    void graphQl<{ marketplace: MarketplaceState }>(
      `query Market($input: MarketBrowseInput) { marketplace(input: $input) { ${marketFields} } }`,
      {
        input: browseInput({
          search,
          kind,
          sort,
          page,
          rarity,
          minPrice,
          maxPrice,
          minLevel,
          maxLevel,
        }),
      },
    )
      .then((data) => {
        if (!cancelled) setMarket(data.marketplace)
      })
      .catch(() => {
        if (!cancelled) setError('Торгові ряди тимчасово не відповідають.')
      })
    return () => {
      cancelled = true
    }
  }, [kind, maxLevel, maxPrice, minLevel, minPrice, page, rarity, search, sort])

  useEffect(() => {
    const input = selectedItemId
      ? { itemId: selectedItemId }
      : selectedResource
        ? {
            resourceType: selectedResource,
            amount: Number(resourceAmount) || 1,
          }
        : null
    if (!input) return
    let cancelled = false
    void graphQl<{ marketQuote: MarketQuote }>(
      'query MarketQuote($input: MarketQuoteInput!) { marketQuote(input: $input) { minimumPrice referencePrice comparableSales saleFeePercent saleFeeAtReference proceedsAtReference } }',
      { input },
    )
      .then((data) => {
        if (!cancelled) setQuote(data.marketQuote)
      })
      .catch(() => {
        if (!cancelled) setQuote(null)
      })
    return () => {
      cancelled = true
    }
  }, [resourceAmount, selectedItemId, selectedResource])

  async function mutate(field: string, input: Record<string, unknown>) {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const inputType =
        field === 'createMarketListing'
          ? 'CreateMarketListingInput'
          : field === 'createMarketResourceListing'
            ? 'CreateMarketResourceListingInput'
            : 'MarketListingCommandInput'
      const data = await graphQl<Record<string, MarketplaceState>>(
        `mutation Market($input: ${inputType}!) { ${field}(input: $input) { ${marketFields} } }`,
        { input: { ...input, idempotencyKey: crypto.randomUUID() } },
      )
      setMarket(data[field])
      if (field === 'createMarketListing') setSelectedItemId('')
      if (field === 'createMarketResourceListing') setSelectedResource('')
    } catch {
      setError(
        'Операцію відхилено: перевірте баланс, стан предмета й актуальність оголошення.',
      )
      await load().catch(() => undefined)
    } finally {
      setPending(false)
    }
  }

  return (
    <section>
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        className="mb-2 h-7 rounded-sm px-2 text-xs"
      >
        <ArrowLeft aria-hidden="true" /> До міських кварталів
      </Button>
      <header className="relative overflow-hidden border border-border/70 bg-background/70 px-5 py-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_45%,oklch(0.46_0.09_45/18%),transparent_34%)]" />
        <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <p className="font-serif text-xs text-ember">
              Ринок Попелястого Прихистку
            </p>
            <h1 className="mt-1 font-serif text-2xl">Торгові ряди</h1>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
              Офіційний анонімний ринок. Усі угоди проходять через ескроу,
              товари зберігаються 24 години, а прямих пересилань між героями
              немає.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px border border-border/60 bg-border/60 text-xs">
            <MarketHeaderFact label="Тривалість лота" value="24 години" />
            <MarketHeaderFact
              label="Комісія"
              value={`${market?.saleFeePercent ?? 5}%`}
            />
            <MarketHeaderFact
              label="Активні лоти"
              value={`${market?.totalListings ?? 0}`}
            />
            <MarketHeaderFact label="Розрахунок" value="Відгомони" />
          </div>
        </div>
      </header>

      <nav
        className="mt-px grid grid-cols-5 gap-px bg-border/70"
        aria-label="Розділи ринку"
      >
        {[
          ['ALL', 'Усі лоти'],
          ['EQUIPMENT', 'Спорядження'],
          ['RESOURCE', 'Ресурси'],
        ].map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant="ghost"
            onClick={() => {
              setKind(value)
              setPage(1)
            }}
            className={`h-9 rounded-none border-t-2 text-xs ${kind === value ? 'border-destructive bg-destructive/10 text-ember' : 'border-transparent bg-background/80'}`}
          >
            {label}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          className="h-9 rounded-none bg-background/80 text-xs"
          onClick={() =>
            document
              .getElementById('my-market-lots')
              ?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          Мої товари
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-9 rounded-none bg-background/80 text-xs"
          onClick={() =>
            document
              .getElementById('market-history')
              ?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          Історія
        </Button>
      </nav>

      {error ? (
        <p className="mt-3 border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-2 grid gap-2 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <aside className="space-y-2 xl:col-start-2 xl:row-start-1">
          <section className="border border-border/70 bg-background/55 p-3">
            <p className="font-mono text-[0.62rem] uppercase tracking-wider text-moss">
              Баланс
            </p>
            <p className="mt-2 flex items-center gap-2 text-lg">
              <Coins className="size-4 text-ember" /> {market?.balance ?? 0}{' '}
              Відгомонів
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Застава за оголошення: {market?.listingDeposit ?? 1}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Комісія з успішного продажу: {market?.saleFeePercent ?? 5}%
            </p>
          </section>

          <section className="border border-border/70 bg-background/55 p-4">
            <p className="font-mono text-[0.62rem] uppercase tracking-wider text-moss">
              Моя торгівля
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-px bg-border/60 text-xs">
              <MarketStat label="Продажі" value={market?.stats.sales ?? 0} />
              <MarketStat
                label="Покупки"
                value={market?.stats.purchases ?? 0}
              />
              <MarketStat label="Отримано" value={market?.stats.earned ?? 0} />
              <MarketStat label="Витрачено" value={market?.stats.spent ?? 0} />
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              Сплачено комісій: {market?.stats.feesPaid ?? 0}
            </p>
          </section>

          <section
            id="my-market-lots"
            className="border border-border/70 bg-background/55 p-4"
          >
            <p className="font-mono text-[0.62rem] uppercase tracking-wider text-ember">
              Виставити предмет
            </p>
            <select
              value={selectedItemId}
              onChange={(event) => {
                setSelectedItemId(event.target.value)
                setSelectedResource('')
                setQuote(null)
              }}
              className="mt-3 h-10 w-full border border-border bg-panel px-3 text-sm"
            >
              <option value="">Оберіть незв’язаний предмет</option>
              {tradeableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.itemLevel} рівень
                </option>
              ))}
            </select>
            <Input
              type="number"
              min={1}
              max={1_000_000}
              value={itemPrice}
              onChange={(event) => setItemPrice(event.target.value)}
              className="mt-2 rounded-sm"
              aria-label="Ціна у Відгомонах Завіси"
            />
            <Button
              type="button"
              disabled={
                pending || !selectedItemId || Number(itemPrice) < 1 || !market
              }
              onClick={() =>
                mutate('createMarketListing', {
                  itemId: selectedItemId,
                  price: Number(itemPrice),
                })
              }
              className="mt-3 w-full rounded-sm bg-ember text-ink"
            >
              Виставити на 24 години
            </Button>
            {selectedItemId && quote ? <QuoteHint quote={quote} /> : null}

            <div className="my-4 border-t border-border/60" />
            <p className="font-mono text-[0.62rem] uppercase tracking-wider text-moss">
              Виставити ресурси
            </p>
            <select
              value={selectedResource}
              onChange={(event) => {
                setSelectedResource(event.target.value)
                setSelectedItemId('')
                setQuote(null)
              }}
              className="mt-3 h-10 w-full border border-border bg-panel px-3 text-sm"
            >
              <option value="">Оберіть ресурс</option>
              {resources
                .filter(
                  (resource) =>
                    resource.amount > 0 && resource.type !== 'VEIL_ECHO',
                )
                .map((resource) => (
                  <option key={resource.type} value={resource.type}>
                    {resourceName(resource.type)} · {resource.amount} шт.
                  </option>
                ))}
            </select>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={1}
                max={10_000}
                value={resourceAmount}
                onChange={(event) => {
                  setResourceAmount(event.target.value)
                  setQuote(null)
                }}
                className="rounded-sm"
                aria-label="Кількість ресурсу"
              />
              <Input
                type="number"
                min={1}
                max={1_000_000}
                value={resourcePrice}
                onChange={(event) => setResourcePrice(event.target.value)}
                className="rounded-sm"
                aria-label="Ціна ресурсного лота"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={
                pending ||
                !selectedResource ||
                Number(resourceAmount) < 1 ||
                Number(resourcePrice) < 1 ||
                !market
              }
              onClick={() =>
                mutate('createMarketResourceListing', {
                  resourceType: selectedResource,
                  amount: Number(resourceAmount),
                  price: Number(resourcePrice),
                })
              }
              className="mt-3 w-full rounded-sm"
            >
              Виставити ресурсний лот
            </Button>
            {selectedResource && quote ? <QuoteHint quote={quote} /> : null}
          </section>

          <section className="border border-border/70 bg-background/55 p-4">
            <p className="font-mono text-[0.62rem] uppercase tracking-wider text-moss">
              Мої товари
            </p>
            <div className="mt-3 space-y-2">
              {market?.myListings.map((listing) => (
                <div key={listing.id} className="border border-border/60 p-3">
                  <p className="text-sm">{listingName(listing)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {listing.price} відгомонів · до{' '}
                    {formatDate(listing.expiresAt)}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      mutate('cancelMarketListing', { listingId: listing.id })
                    }
                    className="mt-2 h-7 w-full rounded-sm text-xs"
                  >
                    Зняти без повернення застави
                  </Button>
                </div>
              )) ?? null}
              {market?.myListings.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Активних товарів немає.
                </p>
              ) : null}
            </div>
          </section>
        </aside>

        <div className="space-y-2 xl:col-start-1 xl:row-start-1">
          <section className="border border-border/70 bg-background/45 p-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[0.62rem] uppercase tracking-wider text-ember">
                  Асортимент
                </p>
                <h2 className="mt-1 font-serif text-xl">
                  Асортимент торгових рядів
                </h2>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {market?.totalListings ?? 0} пропозицій
              </span>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_10rem_10rem]">
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Пошук предмета або ресурсу…"
                className="rounded-sm"
              />
              <select
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value)
                  setPage(1)
                }}
                className="h-10 border border-border bg-panel px-3 text-sm"
              >
                <option value="ALL">Усі товари</option>
                <option value="EQUIPMENT">Спорядження</option>
                <option value="RESOURCE">Ресурси</option>
              </select>
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value)
                  setPage(1)
                }}
                className="h-10 border border-border bg-panel px-3 text-sm"
              >
                <option value="NEWEST">Спершу нові</option>
                <option value="ENDING">Скоро завершаться</option>
                <option value="PRICE_ASC">Ціна: від меншої</option>
                <option value="PRICE_DESC">Ціна: від більшої</option>
              </select>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <select
                value={rarity}
                onChange={(event) => {
                  setRarity(event.target.value)
                  setPage(1)
                }}
                className="h-9 border border-border bg-panel px-2 text-xs"
              >
                <option value="ALL">Уся рідкість</option>
                <option value="COMMON">Звичайні</option>
                <option value="UNCOMMON">Незвичайні</option>
                <option value="RARE">Рідкісні</option>
                <option value="EPIC">Епічні</option>
                <option value="LEGENDARY">Легендарні</option>
                <option value="MYTHIC">Міфічні</option>
                <option value="DIVINE">Божественні</option>
              </select>
              <FilterNumber
                label="Ціна від"
                value={minPrice}
                onChange={(value) => {
                  setMinPrice(value)
                  setPage(1)
                }}
              />
              <FilterNumber
                label="Ціна до"
                value={maxPrice}
                onChange={(value) => {
                  setMaxPrice(value)
                  setPage(1)
                }}
              />
              <FilterNumber
                label="Рівень від"
                value={minLevel}
                onChange={(value) => {
                  setMinLevel(value)
                  setPage(1)
                }}
                max={99}
              />
              <FilterNumber
                label="Рівень до"
                value={maxLevel}
                onChange={(value) => {
                  setMaxLevel(value)
                  setPage(1)
                }}
                max={99}
              />
            </div>
            <p className="mt-4 border-b border-border/60 pb-2 font-serif text-sm text-ember">
              Преміум спорядження
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
              {market?.listings
                .filter((listing) => listing.item)
                .map((listing) => (
                  <MarketCard
                    key={listing.id}
                    listing={listing}
                    pending={pending}
                    affordable={(market?.balance ?? 0) >= listing.price}
                    onBuy={() =>
                      mutate('buyMarketListing', { listingId: listing.id })
                    }
                  />
                )) ?? null}
            </div>
            <p className="mt-4 border-b border-border/60 pb-2 font-serif text-sm text-moss">
              Ресурсні лоти
            </p>
            <div className="mt-2 overflow-hidden border border-border/60">
              <div className="hidden grid-cols-[minmax(10rem,1fr)_6rem_7rem_8rem_5rem] gap-2 bg-background/90 px-3 py-2 font-mono text-[0.58rem] uppercase text-muted-foreground md:grid">
                <span>Ресурс</span>
                <span>Кількість</span>
                <span>За одиницю</span>
                <span>Ціна лота</span>
                <span />
              </div>
              {market?.listings
                .filter((listing) => listing.resource)
                .map((listing) => (
                  <MarketResourceRow
                    key={listing.id}
                    listing={listing}
                    pending={pending}
                    affordable={(market?.balance ?? 0) >= listing.price}
                    onBuy={() =>
                      mutate('buyMarketListing', { listingId: listing.id })
                    }
                  />
                )) ?? null}
            </div>
            {market?.listings.length === 0 ? (
              <div className="mt-4 border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Торгові столи порожні. Перші продавці ще не прибули.
              </div>
            ) : null}
            {(market?.totalPages ?? 1) > 1 ? (
              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || (market?.page ?? 1) <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="h-8 rounded-sm"
                >
                  Попередня
                </Button>
                <span className="font-mono text-xs text-muted-foreground">
                  Сторінка {market?.page ?? 1} / {market?.totalPages ?? 1}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    pending || (market?.page ?? 1) >= (market?.totalPages ?? 1)
                  }
                  onClick={() => setPage((value) => value + 1)}
                  className="h-8 rounded-sm"
                >
                  Наступна
                </Button>
              </div>
            ) : null}
          </section>

          <section
            id="market-history"
            className="border border-border/70 bg-background/45 p-3"
          >
            <p className="font-mono text-[0.62rem] uppercase tracking-wider text-moss">
              Історія угод
            </p>
            <div className="mt-3 divide-y divide-border/50">
              {market?.history.slice(0, 10).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-4 py-2 text-sm"
                >
                  <span>
                    {entry.role === 'BUYER' ? 'Придбано' : 'Продаж'}:{' '}
                    {historyName(entry)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {entry.status} · {entry.price}
                    {entry.role === 'SELLER' && entry.status === 'SOLD'
                      ? ` · отримано ${entry.sellerProceeds}`
                      : ''}
                  </span>
                </div>
              )) ?? null}
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}

function MarketCard({
  listing,
  pending,
  affordable,
  onBuy,
}: {
  listing: Listing
  pending: boolean
  affordable: boolean
  onBuy: () => void
}) {
  return (
    <article className="border border-border/70 bg-panel/70 p-4">
      <div className="flex gap-3">
        <div className="grid size-14 shrink-0 place-items-center border border-border bg-background">
          <Package className="size-5 text-ember" />
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-medium">{listingName(listing)}</h3>
          <p className="mt-1 font-mono text-[0.62rem] uppercase text-ember">
            {listing.item
              ? `${rarityName(listing.item.rarity)} · ${listing.item.itemLevel} рівень`
              : `${rarityName(listing.resource?.rarity ?? 'COMMON')} · ресурсний лот`}
          </p>
        </div>
      </div>
      {listing.item ? (
        <dl className="mt-4 grid grid-cols-3 gap-px bg-border/60 text-center text-xs">
          <Stat label="DMG" value={listing.item.damage} />
          <Stat label="Броня" value={listing.item.armor} />
          <Stat label="HP" value={listing.item.health} />
        </dl>
      ) : (
        <div className="mt-4 border border-border/60 bg-background/70 p-3 text-sm">
          Кількість у лоті:{' '}
          <span className="font-mono text-ember">
            {listing.resource?.amount ?? 0}
          </span>
        </div>
      )}
      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="size-3.5" /> До {formatDate(listing.expiresAt)}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-ember">
            {listing.price} відгомонів
          </p>
          <p className="mt-1 text-[0.62rem] text-muted-foreground">
            Мінімум: {listing.minimumPrice}
          </p>
          {listing.referencePrice !== null ? (
            <p className="mt-1 text-[0.62rem] text-moss">
              Орієнтир: {listing.referencePrice} · угод:{' '}
              {listing.comparableSales}
            </p>
          ) : (
            <p className="mt-1 text-[0.62rem] text-muted-foreground">
              Історії продажів ще немає
            </p>
          )}
        </div>
        <Button
          type="button"
          disabled={pending || !affordable}
          onClick={onBuy}
          className="h-8 rounded-sm"
        >
          <ShoppingBag aria-hidden="true" /> Купити
        </Button>
      </div>
    </article>
  )
}

function MarketResourceRow({
  listing,
  pending,
  affordable,
  onBuy,
}: {
  listing: Listing
  pending: boolean
  affordable: boolean
  onBuy: () => void
}) {
  const amount = listing.resource?.amount ?? 1
  return (
    <div className="grid gap-2 border-t border-border/50 bg-background/55 px-3 py-2 text-xs first:border-t-0 md:grid-cols-[minmax(10rem,1fr)_6rem_7rem_8rem_5rem] md:items-center">
      <span className="font-medium">{listingName(listing)}</span>
      <span className="font-mono text-muted-foreground">{amount}</span>
      <span className="font-mono text-muted-foreground">
        {(listing.price / amount).toFixed(2)}
      </span>
      <span className="font-mono text-ember">{listing.price} відг.</span>
      <Button
        type="button"
        variant="outline"
        disabled={pending || !affordable}
        onClick={onBuy}
        className="h-7 rounded-sm text-[0.65rem]"
      >
        Купити
      </Button>
    </div>
  )
}

function MarketHeaderFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background/80 p-2">
      <p className="font-mono text-[0.52rem] uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-xs text-foreground">{value}</p>
    </div>
  )
}

function listingName(listing: Listing): string {
  return listing.item?.name ?? listing.resource?.name ?? 'Невідомий товар'
}

function historyName(entry: HistoryEntry): string {
  return entry.item?.name ?? entry.resource?.name ?? 'Невідомий товар'
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background/80 p-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono">{value}</dd>
    </div>
  )
}

function MarketStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background/80 p-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-ember">{value}</dd>
    </div>
  )
}

function QuoteHint({ quote }: { quote: MarketQuote }) {
  return (
    <div className="mt-2 border border-moss/30 bg-moss/5 p-2 text-xs leading-5 text-muted-foreground">
      <p>Мінімальна ціна: {quote.minimumPrice}</p>
      <p>
        Ринковий орієнтир: {quote.referencePrice ?? 'ще немає завершених угод'}
      </p>
      <p>
        Після комісії: {quote.proceedsAtReference} · порівнянь:{' '}
        {quote.comparableSales}
      </p>
    </div>
  )
}

function FilterNumber({
  label,
  value,
  onChange,
  max = 1_000_000,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  max?: number
}) {
  return (
    <Input
      type="number"
      min={1}
      max={max}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={label}
      aria-label={label}
      className="h-9 rounded-sm text-xs"
    />
  )
}

function browseInput(values: {
  search: string
  kind: string
  sort: string
  page: number
  rarity: string
  minPrice: string
  maxPrice: string
  minLevel: string
  maxLevel: string
}) {
  const number = (value: string) =>
    value && Number(value) > 0 ? Number(value) : undefined
  return {
    search: values.search || undefined,
    kind: values.kind,
    sort: values.sort,
    page: values.page,
    rarity: values.rarity,
    minPrice: number(values.minPrice),
    maxPrice: number(values.maxPrice),
    minLevel: number(values.minLevel),
    maxLevel: number(values.maxLevel),
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function rarityName(value: string): string {
  return (
    {
      COMMON: 'Звичайний',
      UNCOMMON: 'Незвичайний',
      RARE: 'Рідкісний',
      EPIC: 'Епічний',
      LEGENDARY: 'Легендарний',
      MYTHIC: 'Міфічний',
      DIVINE: 'Божественний',
    }[value] ?? value
  )
}

function resourceName(value: string): string {
  return (
    {
      IRON: 'Залізо',
      COPPER: 'Мідь',
      BRONZE: 'Бронза',
      COAL: 'Вугілля',
      TIMBER: 'Деревина',
      LEATHER: 'Шкіра',
      WEAPON_FRAGMENT: 'Уламок зброї',
      HEALTH_POTION: 'Зілля відновлення',
      MANA_POTION: 'Зілля мани',
      HERBS: 'Лікувальні трави',
      OBSIDIAN_SHARD: 'Уламок обсидіану',
      VEIL_STEEL: 'Сталь Завіси',
      STABILIZED_CATALYST: 'Стабілізований каталізатор',
      CURSED_HEART: 'Серце Проклятого лицаря',
      FALLEN_ELF_EYE: 'Око Павшого ельфа',
      DARK_PRIEST_ASH: 'Попіл Темного жерця',
      BOSS_INVOCATION_SEAL: 'Печатка виклику',
      DARK_PRIEST_INVOCATION_SEAL: 'Печатка Темного жерця',
      DRYAD_HEARTWOOD: 'Серцевина прадавнього кореня',
    }[value] ?? value
  )
}

async function graphQl<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const payload = (await response.json()) as { data?: T; errors?: unknown }
  if (!response.ok || payload.errors || !payload.data)
    throw new Error('MARKETPLACE_REQUEST_FAILED')
  return payload.data
}
