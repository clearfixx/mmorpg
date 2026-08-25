'use client'

import { Activity, AlertTriangle, CircleCheck, CircleX } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const graphqlEndpoint =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql'
const healthEndpoint = graphqlEndpoint.replace(/\/graphql\/?$/, '/health')

type RuntimeStatus = 'CHECKING' | 'HEALTHY' | 'WARNING' | 'ERROR'

interface Diagnostics {
  status: RuntimeStatus
  transferredKilobytes: number | null
  loadMilliseconds: number | null
  apiMilliseconds: number | null
}

const initialDiagnostics: Diagnostics = {
  status: 'CHECKING',
  transferredKilobytes: null,
  loadMilliseconds: null,
  apiMilliseconds: null,
}

export function SiteFooter() {
  const [diagnostics, setDiagnostics] =
    useState<Diagnostics>(initialDiagnostics)

  useEffect(() => {
    let active = true
    let clientError = false
    const healthController = new AbortController()
    const healthTimeout = window.setTimeout(
      () => healthController.abort(),
      4_000,
    )
    const markClientError = () => {
      clientError = true
      setDiagnostics((current) => ({ ...current, status: 'ERROR' }))
    }
    window.addEventListener('error', markClientError)
    window.addEventListener('unhandledrejection', markClientError)

    const navigation = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined
    const resources = performance.getEntriesByType(
      'resource',
    ) as PerformanceResourceTiming[]
    const transferredBytes =
      (navigation?.transferSize ?? 0) +
      resources.reduce((total, resource) => total + resource.transferSize, 0)
    const startedAt = performance.now()

    void fetch(healthEndpoint, {
      cache: 'no-store',
      signal: healthController.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as { status?: string }
        if (!active) return
        const apiHealthy = response.ok && payload.status === 'ok'
        setDiagnostics({
          status: clientError ? 'ERROR' : apiHealthy ? 'HEALTHY' : 'WARNING',
          transferredKilobytes:
            transferredBytes > 0 ? Math.round(transferredBytes / 1_024) : null,
          loadMilliseconds: navigation
            ? Math.round(navigation.duration)
            : Math.round(performance.now()),
          apiMilliseconds: Math.round(performance.now() - startedAt),
        })
      })
      .catch(() => {
        if (!active) return
        setDiagnostics({
          status: clientError ? 'ERROR' : 'WARNING',
          transferredKilobytes:
            transferredBytes > 0 ? Math.round(transferredBytes / 1_024) : null,
          loadMilliseconds: navigation
            ? Math.round(navigation.duration)
            : Math.round(performance.now()),
          apiMilliseconds: null,
        })
      })
      .finally(() => window.clearTimeout(healthTimeout))

    return () => {
      active = false
      window.clearTimeout(healthTimeout)
      healthController.abort()
      window.removeEventListener('error', markClientError)
      window.removeEventListener('unhandledrejection', markClientError)
    }
  }, [])

  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-ink/95 text-[0.65rem] text-muted-foreground shadow-[0_-8px_24px_rgba(0,0,0,0.28)] backdrop-blur">
      <div className="mx-auto flex min-h-8 max-w-[120rem] flex-wrap items-center justify-between gap-x-5 gap-y-1 px-3 py-1 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-mono text-foreground/80">© 2026 VeilFall</span>
          <nav aria-label="Службова навігація" className="flex gap-3">
            <Link href="/rules" className="transition-colors hover:text-ember">
              Правила
            </Link>
            <Link href="/offer" className="transition-colors hover:text-ember">
              Публічна оферта
            </Link>
            <Link
              href="/contacts"
              className="transition-colors hover:text-ember"
            >
              Контакти
            </Link>
          </nav>
        </div>
        <DiagnosticsView diagnostics={diagnostics} />
      </div>
    </footer>
  )
}

function DiagnosticsView({ diagnostics }: { diagnostics: Diagnostics }) {
  const config = {
    CHECKING: {
      icon: Activity,
      label: 'Перевірка',
      color: 'text-amber-400',
    },
    HEALTHY: {
      icon: CircleCheck,
      label: 'Системи справні',
      color: 'text-moss',
    },
    WARNING: {
      icon: AlertTriangle,
      label: 'API недоступний',
      color: 'text-amber-400',
    },
    ERROR: {
      icon: CircleX,
      label: 'Помилка клієнта',
      color: 'text-destructive',
    },
  }[diagnostics.status]
  const StatusIcon = config.icon

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 font-mono"
      aria-label="Технічний стан сторінки"
    >
      <span className={`inline-flex items-center gap-1 ${config.color}`}>
        <StatusIcon className="size-3" aria-hidden="true" /> {config.label}
      </span>
      <span className="hidden sm:inline">
        API: {formatMetric(diagnostics.apiMilliseconds, 'мс')}
      </span>
      <span className="hidden md:inline">
        Завантаження: {formatMetric(diagnostics.loadMilliseconds, 'мс')}
      </span>
      <span className="hidden lg:inline">
        Передано: {formatMetric(diagnostics.transferredKilobytes, 'КіБ')}
      </span>
    </div>
  )
}

function formatMetric(value: number | null, unit: string) {
  return value === null ? '—' : `${value} ${unit}`
}
