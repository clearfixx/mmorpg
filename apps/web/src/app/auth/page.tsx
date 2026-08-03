import Link from 'next/link'

import { AuthPanel } from '@/components/auth/auth-panel'

export default function AuthPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-6 py-10 text-foreground">
      <div
        className="veil-grid absolute inset-0 opacity-35"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-14 lg:grid-cols-[1fr_28rem]">
        <section>
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-[0.3em] text-ember"
          >
            ← Veilfall
          </Link>
          <h1 className="mt-10 max-w-2xl text-5xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            Ваше ім’я ще не вписане у Хроніку.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
            Створіть обліковий запис або поверніться до героя, що вже ступив за
            межу Завіси.
          </p>
        </section>
        <section className="border border-border/70 bg-panel/75 p-2 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="border border-border/60 p-6 sm:p-8">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Identity gateway
            </p>
            <h2 className="mt-3 text-2xl font-medium">Вхід до світу</h2>
            <div className="mt-7">
              <AuthPanel />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
