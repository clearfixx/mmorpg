import { Button } from '@/components/ui/button'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const milestones = [
  ['01', 'Особистий шлях', 'Герой, тактичний бій, здобич і видиме посилення.'],
  [
    '02',
    'Сила клану',
    'Спільний розвиток, боси та речі, яких не здобути наодинці.',
  ],
  [
    '03',
    'Жива економіка',
    'Ризикові походи, ремесла, обмін і постійна цінність ресурсів.',
  ],
]

export default async function Home() {
  if (await hasAuthenticatedViewer()) redirect('/game')

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        className="veil-grid absolute inset-0 opacity-35"
        aria-hidden="true"
      />
      <div
        className="absolute -left-32 top-24 h-96 w-96 rounded-full bg-ember/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 lg:px-10">
        <header className="flex items-center justify-between border-b border-border/70 pb-5">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.36em] text-ember">
              Project Veilfall
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Падіння Завіси · pre-production
            </p>
          </div>
          <span className="rounded-full border border-moss/35 bg-moss/10 px-3 py-1 font-mono text-xs text-moss">
            Foundation ready
          </span>
        </header>

        <section className="grid flex-1 items-center gap-16 py-20 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Text-first · Clan-centric · Server-authoritative
            </p>
            <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-6xl lg:text-[4.8rem]">
              Стати сильним можна самому.
              <span className="mt-2 block text-ember">
                Стати легендою — ні.
              </span>
            </h1>
            <p className="mt-8 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
              Браузерна MMORPG про тактичні рішення, ризикову здобич і клани, що
              разом долають ворогів, непідвладних навіть найсильнішому герою.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-sm bg-ember px-6 text-ink hover:bg-ember-bright"
              >
                <Link href="/auth">Почати перший шлях</Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 rounded-sm border-border/90 bg-panel/40 px-6"
              >
                Vertical Slice A
              </Button>
            </div>
          </div>

          <aside className="border border-border/70 bg-panel/65 p-2 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="border border-border/60 p-6 sm:p-8">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
                The first journey
              </p>
              <div className="mt-7 space-y-7">
                {milestones.map(([number, title, description]) => (
                  <div
                    key={number}
                    className="grid grid-cols-[2.5rem_1fr] gap-4"
                  >
                    <span className="font-mono text-sm text-ember">
                      {number}
                    </span>
                    <div>
                      <h2 className="text-lg font-medium">{title}</h2>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 border-t border-border/60 pt-5 font-mono text-xs leading-6 text-muted-foreground">
                NEXT.JS 16 / NESTJS / GRAPHQL
                <br />
                TAILWIND / SHADCN / POSTGRESQL
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}

async function hasAuthenticatedViewer(): Promise<boolean> {
  const cookieHeader = (await cookies()).toString()
  if (!cookieHeader) return false
  try {
    const response = await fetch(
      process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql',
      {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'content-type': 'application/json',
          cookie: cookieHeader,
        },
        body: JSON.stringify({ query: '{ viewer { id } }' }),
      },
    )
    const payload = (await response.json()) as {
      data?: { viewer?: { id: string } | null }
    }
    return response.ok && Boolean(payload.data?.viewer?.id)
  } catch {
    return false
  }
}
