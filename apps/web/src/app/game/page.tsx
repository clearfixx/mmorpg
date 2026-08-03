import Link from 'next/link'

export default function GamePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <section className="max-w-2xl border border-border/70 bg-panel/70 p-10 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-moss">
          Character ready
        </p>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em]">
          Герой увійшов до Хроніки.
        </h1>
        <p className="mt-5 leading-7 text-muted-foreground">
          Наступний етап відкриє Зламану заставу, перший вибір і шлях до
          тактичної сутички.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block text-sm text-ember underline underline-offset-4"
        >
          Повернутися на початок
        </Link>
      </section>
    </main>
  )
}
