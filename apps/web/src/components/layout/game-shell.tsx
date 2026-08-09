'use client'

import {
  Anvil,
  Bell,
  BookOpen,
  CircleUserRound,
  Coins,
  Compass,
  Crown,
  House,
  Map,
  Package,
  Settings,
  Shield,
  Swords,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

export type GameSection =
  | 'LOBBY'
  | 'CHARACTER'
  | 'INVENTORY'
  | 'QUESTS'
  | 'CRAFTING'
  | 'CLAN'
  | 'ARENA'
  | 'MAP'
  | 'SETTINGS'

interface GameShellProps {
  hero: {
    name: string
    level: number
    archetype: string
    experienceIntoLevel: number
    experienceForNextLevel: number
    health: number
    damage: number
    armor: number
    gold: number
  }
  clanName: string | null
  activeSection: GameSection
  locationName: string
  availableSections?: readonly GameSection[]
  resourceTotal: number
  onNavigate: (section: GameSection) => void
  children: ReactNode
}

const navigation = [
  { section: 'LOBBY', label: 'Лобі', icon: House },
  { section: 'CHARACTER', label: 'Персонаж', icon: CircleUserRound },
  { section: 'INVENTORY', label: 'Інвентар', icon: Package },
  { section: 'QUESTS', label: 'Квести', icon: BookOpen, locked: true },
  { section: 'CRAFTING', label: 'Крафт', icon: Anvil },
  { section: 'CLAN', label: 'Клан', icon: Users },
  { section: 'ARENA', label: 'Арена', icon: Swords, locked: true },
  { section: 'MAP', label: 'Мапа', icon: Map },
  { section: 'SETTINGS', label: 'Налаштування', icon: Settings, locked: true },
] as const

export function GameShell({
  hero,
  clanName,
  activeSection,
  locationName,
  availableSections,
  resourceTotal,
  onNavigate,
  children,
}: GameShellProps) {
  const experiencePercent = Math.min(
    100,
    (hero.experienceIntoLevel / hero.experienceForNextLevel) * 100,
  )

  return (
    <div className="min-h-screen bg-background pb-4 text-foreground lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,1fr)_18rem]">
      <aside className="border-b border-border/80 bg-ink/95 lg:sticky lg:top-0 lg:h-[calc(100vh-2rem)] lg:border-r lg:border-b-0">
        <div className="border-b border-border/80 px-5 py-4">
          <p className="font-serif text-2xl tracking-[0.14em] text-foreground">
            VEILFALL
          </p>
          <p className="mt-1 font-mono text-[0.55rem] uppercase tracking-[0.28em] text-destructive">
            Завіса пам’ятає
          </p>
        </div>
        <nav
          aria-label="Основна навігація гри"
          className="flex overflow-x-auto p-2 lg:block"
        >
          {navigation.map((item) => {
            const Icon = item.icon
            const active = activeSection === item.section
            const unavailable = availableSections
              ? !availableSections.includes(item.section)
              : false
            return (
              <Button
                key={item.section}
                type="button"
                variant="ghost"
                disabled={unavailable || ('locked' in item && item.locked)}
                onClick={() => onNavigate(item.section)}
                className={`h-10 shrink-0 justify-start rounded-none border-l-2 px-3 text-xs lg:w-full ${
                  active
                    ? 'border-destructive bg-destructive/12 text-foreground'
                    : 'border-transparent text-muted-foreground'
                }`}
              >
                <Icon
                  className={active ? 'text-ember' : ''}
                  aria-hidden="true"
                />
                {item.label}
              </Button>
            )
          })}
        </nav>
        <div className="hidden border-t border-border/80 p-4 lg:block">
          <p className="font-medium">{hero.name}</p>
          <p className="mt-1 text-[0.65rem] text-muted-foreground">
            Рівень {hero.level} · {archetypeName(hero.archetype)}
          </p>
          <div className="mt-3 space-y-2 font-mono text-[0.65rem]">
            <ShellStat
              label="Здоров’я"
              value={hero.health}
              color="bg-destructive"
            />
            <ShellStat label="Атака" value={hero.damage} color="bg-ember" />
            <ShellStat label="Захист" value={hero.armor} color="bg-moss" />
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-b border-border/80 bg-panel/90 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-60 items-center gap-3">
              <div className="grid size-11 place-items-center border border-ember/50 bg-ember/5">
                <Shield className="text-ember" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{hero.name}</p>
                <div className="mt-1 flex justify-between font-mono text-[0.6rem] text-muted-foreground">
                  <span>Рівень {hero.level}</span>
                  <span>{Math.round(experiencePercent)}%</span>
                </div>
                <div className="mt-1 h-1 bg-background">
                  <div
                    className="h-full bg-destructive"
                    style={{ width: `${experiencePercent}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-px bg-border/70 text-xs">
              <TopResource icon={Crown} label={clanName ?? 'Без клану'} />
              <TopResource icon={Coins} label={`${hero.gold} золота`} />
              <TopResource icon={Compass} label={`${resourceTotal} ресурсів`} />
              <button
                type="button"
                aria-label="Сповіщення"
                className="grid size-11 place-items-center bg-background/80 text-muted-foreground hover:text-ember"
              >
                <Bell className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>
        <div className="veil-game-surface min-h-[calc(100vh-7rem)] p-3 sm:p-5">
          {children}
        </div>
      </div>

      <aside className="hidden border-l border-border/80 bg-ink/90 p-4 xl:block">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-ember">
          Хроніка
        </p>
        <div className="mt-3 space-y-px">
          <ChronicleItem title="Фронт Завіси рухається" time="щойно" />
          <ChronicleItem title="Майстерні міста працюють" time="5 хв" />
          <ChronicleItem
            title={
              clanName ? `Клан ${clanName} тримає раду` : 'Клани шукають героїв'
            }
            time="18 хв"
          />
        </div>
        <div className="mt-5 border-t border-border/70 pt-4">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-moss">
            Стан світу
          </p>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Локація</dt>
              <dd>{locationName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Активні події</dt>
              <dd className="text-ember">3</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Герої онлайн</dt>
              <dd className="text-moss">—</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  )
}

function TopResource({
  icon: Icon,
  label,
}: {
  icon: typeof Crown
  label: string
}) {
  return (
    <div className="flex h-11 items-center gap-2 bg-background/80 px-3">
      <Icon className="size-4 text-ember" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </div>
  )
}

function ShellStat({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-1 h-px bg-border">
        <div className={`h-full w-3/4 ${color}`} />
      </div>
    </div>
  )
}

function ChronicleItem({ title, time }: { title: string; time: string }) {
  return (
    <div className="border border-border/60 bg-background/55 p-3">
      <p className="text-xs">{title}</p>
      <p className="mt-1 font-mono text-[0.6rem] text-muted-foreground">
        {time}
      </p>
    </div>
  )
}

function archetypeName(archetype: string) {
  return {
    VANGUARD: 'Воїн',
    RANGER: 'Мисливець',
    ARCANIST: 'Маг',
  }[archetype]
}
