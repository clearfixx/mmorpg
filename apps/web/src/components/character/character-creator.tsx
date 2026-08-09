'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const endpoint =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql'
const avatars = [
  'standard-01',
  'standard-02',
  'standard-03',
  'standard-04',
  'standard-05',
] as const
const archetypes = [
  ['VANGUARD', 'Авангард', 'Витривалий захисник, що зупиняє важкі атаки.'],
  [
    'RANGER',
    'Слідопит',
    'Швидкий боєць, який покладається на реакцію та кровотечу.',
  ],
  ['ARCANIST', 'Арканіст', 'Контролює бій маною, захистом і перериваннями.'],
] as const

export function CharacterCreator() {
  const router = useRouter()
  const [archetype, setArchetype] = useState('VANGUARD')
  const [avatarMode, setAvatarMode] = useState<'STATIC' | 'DYNAMIC'>('STATIC')
  const [avatar, setAvatar] = useState<string>('standard-01')
  const [pending, setPending] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void checkExistingCharacter().then((destination) => {
      if (destination) router.replace(destination)
      else setChecking(false)
    })
  }, [router])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const form = new FormData(event.currentTarget)

    const input = {
      name: String(form.get('name') ?? ''),
      archetype,
      origin: String(form.get('origin') ?? 'ROAD_SURVIVOR'),
      avatarMode,
      ...(avatarMode === 'STATIC' ? { staticAvatarId: avatar } : {}),
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query:
            'mutation CreateCharacter($input: CreateCharacterInput!) { createCharacter(input: $input) { id name archetype level avatarMode staticAvatarId } }',
          variables: { input },
        }),
      })
      const payload: unknown = await response.json()
      if (!response.ok || hasGraphqlErrors(payload))
        throw new Error('CREATE_FAILED')
      router.push('/game')
    } catch {
      setError(
        'Не вдалося створити героя. Перевірте ім’я або спробуйте інший варіант.',
      )
      setPending(false)
    }
  }

  if (checking)
    return (
      <p className="font-mono text-sm text-muted-foreground">
        Перевіряємо Хроніку…
      </p>
    )

  return (
    <form onSubmit={submit} className="space-y-9">
      <div className="space-y-2">
        <Label htmlFor="character-name">Ім’я героя</Label>
        <Input
          id="character-name"
          name="name"
          required
          minLength={3}
          maxLength={24}
          pattern="[A-Za-zА-Яа-яІіЇїЄєҐґ0-9 '\-]{3,24}"
          className="h-12 rounded-sm bg-background/60"
          placeholder="Вартовий Краю"
        />
        <p className="text-xs text-muted-foreground">
          3–24 символи. Службові та зайняті імена недоступні.
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Архетип</legend>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {archetypes.map(([value, title, description]) => (
            <button
              key={value}
              type="button"
              onClick={() => setArchetype(value)}
              className={`border p-4 text-left transition ${archetype === value ? 'border-ember bg-ember/10' : 'border-border/70 bg-background/40 hover:border-border'}`}
            >
              <span className="font-medium">{title}</span>
              <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                {description}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="origin">Походження</Label>
        <select
          id="origin"
          name="origin"
          className="h-12 w-full border border-input bg-background/60 px-3 text-sm outline-none focus:border-ring"
        >
          <option value="FORMER_SENTINEL">Колишній вартовий</option>
          <option value="ROAD_SURVIVOR">Той, хто вижив на тракті</option>
          <option value="ARCHIVE_EXILE">Вигнанець Архіву</option>
        </select>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Аватар</legend>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant={avatarMode === 'STATIC' ? 'default' : 'outline'}
            onClick={() => setAvatarMode('STATIC')}
          >
            Статичний
          </Button>
          <Button
            type="button"
            variant={avatarMode === 'DYNAMIC' ? 'default' : 'outline'}
            onClick={() => setAvatarMode('DYNAMIC')}
          >
            Динамічний
          </Button>
        </div>
        {avatarMode === 'STATIC' ? (
          <div className="mt-4 grid grid-cols-5 gap-2">
            {avatars.map((value, index) => (
              <button
                key={value}
                type="button"
                aria-label={`Стандартний аватар ${index + 1}`}
                onClick={() => setAvatar(value)}
                className={`aspect-square border font-mono text-lg ${avatar === value ? 'border-ember bg-ember/15 text-ember' : 'border-border/70 bg-background/50 text-muted-foreground'}`}
              >
                {String(index + 1).padStart(2, '0')}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-4 border border-moss/30 bg-moss/5 p-4 text-sm leading-6 text-muted-foreground">
            Портрет змінюватиметься разом із видимим екіпіруванням героя.
          </p>
        )}
      </fieldset>

      {error && (
        <p
          role="alert"
          className="border-l-2 border-destructive bg-destructive/10 px-4 py-3 text-sm"
        >
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-sm bg-ember text-ink hover:bg-ember-bright"
      >
        {pending ? 'Герой входить у Хроніку…' : 'Створити героя'}
      </Button>
    </form>
  )
}

async function checkExistingCharacter(): Promise<string | null> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ viewer { id } myCharacter { id } }' }),
    })
    const payload: unknown = await response.json()
    if (hasGraphqlErrors(payload)) return '/auth'
    if (typeof payload === 'object' && payload !== null && 'data' in payload) {
      const data = payload.data as { viewer?: unknown; myCharacter?: unknown }
      if (!data.viewer) return '/auth'
      if (data.myCharacter) return '/game'
    }
    return null
  } catch {
    return '/auth'
  }
}

function hasGraphqlErrors(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'errors' in value
}
