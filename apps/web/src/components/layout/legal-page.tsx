import Link from 'next/link'

export function LegalPage({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-16">
      <article className="w-full max-w-3xl border border-border/70 bg-panel/70 p-6 sm:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-ember">
          VeilFall · службова інформація
        </p>
        <h1 className="mt-4 text-3xl font-semibold">{title}</h1>
        <div className="mt-6 space-y-4 text-sm leading-7 text-muted-foreground">
          {children}
        </div>
        <Link
          href="/"
          className="mt-8 inline-block text-sm text-ember hover:text-ember-bright"
        >
          Повернутися до VeilFall
        </Link>
      </article>
    </main>
  )
}
