import { CharacterCreator } from '@/components/character/character-creator'

export default function CreateCharacterPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-5 py-8 text-foreground">
      <div
        className="veil-grid absolute inset-0 opacity-30"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-6xl">
        <header className="border-b border-border/70 pb-5">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-ember">
            Character foundation
          </p>
        </header>
        <section className="grid gap-12 py-12 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <h1 className="text-5xl font-semibold leading-[0.98] tracking-[-0.05em]">
              Оберіть, ким вас запам’ятає світ.
            </h1>
            <p className="mt-6 leading-7 text-muted-foreground">
              Ім’я належатиме лише одному герою. Архетип визначить перші бойові
              можливості, але не замкне подальший розвиток.
            </p>
          </div>
          <div className="border border-border/70 bg-panel/75 p-2">
            <div className="border border-border/60 p-6 sm:p-8">
              <CharacterCreator />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
