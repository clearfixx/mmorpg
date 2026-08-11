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
  item: MarketItem
  price: number
  deposit: number
  status: string
  expiresAt: string
  createdAt: string
  own: boolean
}

interface HistoryEntry {
  id: string
  item: MarketItem
  price: number
  status: string
  role: string
  completedAt: string
}

interface MarketplaceState {
  balance: number
  listingDeposit: number
  listings: Listing[]
  myListings: Listing[]
  history: HistoryEntry[]
}

interface InventoryLike {
  chest: MarketItem[]
  backpack: MarketItem[]
}

const marketFields =
  'balance listingDeposit listings { id price deposit status expiresAt createdAt own item { id name itemLevel rarity rollQuality damage armor health binding setName } } myListings { id price deposit status expiresAt createdAt own item { id name itemLevel rarity rollQuality damage armor health binding setName } } history { id price status role completedAt item { id name itemLevel rarity rollQuality damage armor health binding setName } }'

export function Marketplace({
  inventory,
  onBack,
}: {
  inventory: InventoryLike | null
  onBack: () => void
}) {
  const [market, setMarket] = useState<MarketplaceState | null>(null)
  const [selectedItemId, setSelectedItemId] = useState('')
  const [price, setPrice] = useState('1')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tradeableItems = useMemo(
    () => {
      const listed = new Set(
        market?.myListings.map((listing) => listing.item.id) ?? [],
      )
      return [...(inventory?.chest ?? []), ...(inventory?.backpack ?? [])].filter(
        (item) => item.binding !== 'BOUND' && !listed.has(item.id),
      )
    },
    [inventory, market?.myListings],
  )

  const load = useCallback(async () => {
    const data = await graphQl<{ marketplace: MarketplaceState }>(
      `{ marketplace { ${marketFields} } }`,
    )
    setMarket(data.marketplace)
  }, [])

  useEffect(() => {
    void load().catch(() => setError('Торгові ряди тимчасово не відповідають.'))
  }, [load])

  async function mutate(field: string, input: Record<string, unknown>) {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const data = await graphQl<Record<string, MarketplaceState>>(
        `mutation Market($input: ${field === 'createMarketListing' ? 'CreateMarketListingInput' : 'MarketListingCommandInput'}!) { ${field}(input: $input) { ${marketFields} } }`,
        { input: { ...input, idempotencyKey: crypto.randomUUID() } },
      )
      setMarket(data[field])
      if (field === 'createMarketListing') setSelectedItemId('')
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
    <section className="mt-2">
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        className="mb-5 h-8 rounded-sm px-2"
      >
        <ArrowLeft aria-hidden="true" /> До міських кварталів
      </Button>
      <header className="border border-border/70 bg-background/60 p-5">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-ember">
          Попелястий Прихисток · торгові ряди
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Анонімний майданчик</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Імена продавців приховані. Оголошення діє 24 години. Застава
          повертається лише після продажу; скасування або завершення часу спалює
          її назавжди.
        </p>
      </header>

      {error ? (
        <p className="mt-3 border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-3 grid gap-3 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="space-y-3">
          <section className="border border-border/70 bg-background/55 p-4">
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
          </section>

          <section className="border border-border/70 bg-background/55 p-4">
            <p className="font-mono text-[0.62rem] uppercase tracking-wider text-ember">
              Виставити предмет
            </p>
            <select
              value={selectedItemId}
              onChange={(event) => setSelectedItemId(event.target.value)}
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
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="mt-2 rounded-sm"
              aria-label="Ціна у Відгомонах Завіси"
            />
            <Button
              type="button"
              disabled={
                pending || !selectedItemId || Number(price) < 1 || !market
              }
              onClick={() =>
                mutate('createMarketListing', {
                  itemId: selectedItemId,
                  price: Number(price),
                })
              }
              className="mt-3 w-full rounded-sm bg-ember text-ink"
            >
              Виставити на 24 години
            </Button>
          </section>

          <section className="border border-border/70 bg-background/55 p-4">
            <p className="font-mono text-[0.62rem] uppercase tracking-wider text-moss">
              Мої товари
            </p>
            <div className="mt-3 space-y-2">
              {market?.myListings.map((listing) => (
                <div key={listing.id} className="border border-border/60 p-3">
                  <p className="text-sm">{listing.item.name}</p>
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

        <div className="space-y-3">
          <section className="border border-border/70 bg-background/45 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[0.62rem] uppercase tracking-wider text-ember">
                  Асортимент
                </p>
                <h2 className="mt-1 text-xl font-medium">
                  Спорядження мандрівників
                </h2>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {market?.listings.length ?? 0} пропозицій
              </span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {market?.listings.map((listing) => (
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
            {market?.listings.length === 0 ? (
              <div className="mt-4 border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Торгові столи порожні. Перші продавці ще не прибули.
              </div>
            ) : null}
          </section>

          <section className="border border-border/70 bg-background/45 p-4">
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
                    {entry.item.name}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {entry.status} · {entry.price}
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
          <h3 className="truncate font-medium">{listing.item.name}</h3>
          <p className="mt-1 font-mono text-[0.62rem] uppercase text-ember">
            {rarityName(listing.item.rarity)} · {listing.item.itemLevel} рівень
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-px bg-border/60 text-center text-xs">
        <Stat label="DMG" value={listing.item.damage} />
        <Stat label="Броня" value={listing.item.armor} />
        <Stat label="HP" value={listing.item.health} />
      </dl>
      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="size-3.5" /> До {formatDate(listing.expiresAt)}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="font-mono text-sm text-ember">
          {listing.price} відгомонів
        </span>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background/80 p-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono">{value}</dd>
    </div>
  )
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
