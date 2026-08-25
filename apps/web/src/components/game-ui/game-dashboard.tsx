'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

export const gameUi = {
  pageGap: 'space-y-2',
  panelPadding: 'p-3',
  heroMinHeight: 'min-h-[17rem]',
  controlHeight: 'h-9',
} as const

export function GamePosterGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {children}
    </div>
  )
}

export function GameHeroBanner({
  eyebrow,
  title,
  subtitle,
  description,
  footer,
  aside,
}: {
  eyebrow: string
  title: ReactNode
  subtitle?: string
  description: ReactNode
  footer?: ReactNode
  aside?: ReactNode
}) {
  return (
    <section
      className={`relative overflow-hidden border border-border/70 bg-background/70 ${gameUi.heroMinHeight}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_45%,oklch(0.46_0.09_45/18%),transparent_38%)]" />
      <div className="relative grid h-full min-h-[17rem] gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex min-w-0 flex-col justify-between">
          <div>
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.25em] text-ember">
              {eyebrow}
            </p>
            <h1 className="mt-2 font-serif text-3xl leading-none">{title}</h1>
            {subtitle ? (
              <p className="mt-2 font-serif text-sm text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
            <div className="mt-4 max-w-2xl text-xs leading-5 text-muted-foreground">
              {description}
            </div>
          </div>
          {footer ? <div className="mt-5">{footer}</div> : null}
        </div>
        <div className="border border-border/70 bg-background/75 p-4">
          {aside}
        </div>
      </div>
    </section>
  )
}

export function GamePanel({
  eyebrow,
  title,
  action,
  children,
  className = '',
  id,
}: {
  eyebrow?: string
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section
      id={id}
      className={`border border-border/70 bg-background/50 ${gameUi.panelPadding} ${className}`}
    >
      {eyebrow || title || action ? (
        <header className="flex min-h-10 items-center justify-between gap-3 border-b border-border/60 pb-2">
          <div>
            {eyebrow ? (
              <p className="font-mono text-[0.58rem] uppercase tracking-wider text-ember">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="mt-1 font-serif text-lg">{title}</h2>
            ) : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={eyebrow || title || action ? 'mt-3' : ''}>{children}</div>
    </section>
  )
}

export function GameMetric({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="bg-background/80 p-2">
      <dt className="font-mono text-[0.52rem] uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm text-foreground">{value}</dd>
    </div>
  )
}

export function GameServiceCard({
  icon: Icon,
  title,
  description,
  status = 'Доступно',
  action,
  onClick,
  locked = false,
  className = '',
}: {
  icon: LucideIcon
  title: string
  description: string
  status?: string
  action: string
  onClick?: () => void
  locked?: boolean
  className?: string
}) {
  return (
    <article
      className={`flex min-h-56 flex-col overflow-hidden border border-border/70 bg-background/70 ${className}`}
    >
      <div className="relative grid h-24 shrink-0 place-items-center overflow-hidden border-b border-border/70 bg-[radial-gradient(circle_at_50%_30%,oklch(0.48_0.1_45/28%),transparent_60%),linear-gradient(to_bottom,oklch(0.18_0.02_40),oklch(0.1_0.01_35))]">
        <div className="grid size-11 place-items-center border border-ember/35 bg-background/60 shadow-[0_0_2rem_oklch(0.5_0.1_45/18%)]">
          <Icon
            className={`size-5 ${locked ? 'text-muted-foreground' : 'text-ember'}`}
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="font-serif text-sm">{title}</h3>
        <p className="mt-2 flex-1 text-[0.68rem] leading-4 text-muted-foreground">
          {description}
        </p>
        <p
          className={`mt-2 text-[0.6rem] ${locked ? 'text-muted-foreground' : 'text-moss'}`}
        >
          ● {status}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={locked}
          onClick={onClick}
          className="mt-2 h-8 w-full rounded-sm text-[0.65rem]"
        >
          {action}
        </Button>
      </div>
    </article>
  )
}
