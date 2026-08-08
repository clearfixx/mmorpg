'use client'

import { Eye, EyeOff, WandSparkles } from 'lucide-react'
import { FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  generateStrongPassword,
  passwordStrength,
  type PasswordStrength,
} from '@/components/auth/password'

type Mode = 'login' | 'register'

const operations = {
  login:
    'mutation Login($input: LoginInput!) { login(input: $input) { authenticated viewer { id email role } } }',
  register:
    'mutation Register($input: RegisterInput!) { register(input: $input) { authenticated viewer { id email role } } }',
} as const

export function AuthPanel() {
  const [mode, setMode] = useState<Mode>('login')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwords, setPasswords] = useState<Record<Mode, string>>({
    login: '',
    register: '',
  })
  const [visible, setVisible] = useState<Record<Mode, boolean>>({
    login: false,
    register: false,
  })

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')

    try {
      const response = await fetch(
        process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query: operations[mode],
            variables: { input: { email, password } },
          }),
        },
      )
      const payload: unknown = await response.json()
      if (!response.ok || hasGraphqlErrors(payload))
        throw new Error('AUTHENTICATION_FAILED')
      window.location.assign(mode === 'login' ? '/game' : '/character/create')
    } catch {
      setError(
        mode === 'login'
          ? 'Не вдалося увійти. Перевірте введені дані.'
          : 'Не вдалося створити акаунт із цими даними.',
      )
      setPending(false)
    }
  }

  return (
    <Tabs
      value={mode}
      onValueChange={(value) => setMode(value as Mode)}
      className="w-full"
    >
      <TabsList className="grid h-11 w-full grid-cols-2 rounded-sm border border-border/70 bg-background/50 p-1">
        <TabsTrigger value="login" className="rounded-sm">
          Вхід
        </TabsTrigger>
        <TabsTrigger value="register" className="rounded-sm">
          Реєстрація
        </TabsTrigger>
      </TabsList>
      {(['login', 'register'] as const).map((tab) => (
        <TabsContent key={tab} value={tab} className="mt-7">
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor={`${tab}-email`}>Електронна пошта</Label>
              <Input
                id={`${tab}-email`}
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={320}
                className="h-12 rounded-sm bg-background/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${tab}-password`}>Пароль</Label>
              <div className="relative">
                <Input
                  id={`${tab}-password`}
                  name="password"
                  type={visible[tab] ? 'text' : 'password'}
                  value={passwords[tab]}
                  onChange={(event) =>
                    setPasswords((current) => ({
                      ...current,
                      [tab]: event.target.value,
                    }))
                  }
                  autoComplete={
                    tab === 'login' ? 'current-password' : 'new-password'
                  }
                  required
                  minLength={tab === 'register' ? 12 : 1}
                  maxLength={128}
                  className="h-12 rounded-sm bg-background/60 pr-12"
                />
                <button
                  type="button"
                  onClick={() =>
                    setVisible((current) => ({
                      ...current,
                      [tab]: !current[tab],
                    }))
                  }
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted-foreground transition hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  aria-label={
                    visible[tab] ? 'Приховати пароль' : 'Показати пароль'
                  }
                  aria-pressed={visible[tab]}
                >
                  {visible[tab] ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {tab === 'register' && (
                <RegistrationPasswordTools
                  password={passwords.register}
                  onGenerate={() => {
                    setPasswords((current) => ({
                      ...current,
                      register: generateStrongPassword(),
                    }))
                    setVisible((current) => ({ ...current, register: true }))
                  }}
                />
              )}
            </div>
            {error && (
              <p
                role="alert"
                className="border-l-2 border-destructive bg-destructive/10 px-4 py-3 text-sm text-foreground"
              >
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={pending}
              className="h-12 w-full rounded-sm bg-ember text-ink hover:bg-ember-bright"
            >
              {pending
                ? 'Виконується…'
                : tab === 'login'
                  ? 'Увійти до гри'
                  : 'Створити акаунт'}
            </Button>
          </form>
        </TabsContent>
      ))}
    </Tabs>
  )
}

const strengthPresentation: Record<
  PasswordStrength,
  { label: string; width: string; color: string }
> = {
  weak: { label: 'Ненадійний пароль', width: 'w-1/3', color: 'bg-destructive' },
  medium: {
    label: 'Середня надійність',
    width: 'w-2/3',
    color: 'bg-amber-400',
  },
  strong: { label: 'Надійний пароль', width: 'w-full', color: 'bg-moss' },
}

function RegistrationPasswordTools({
  password,
  onGenerate,
}: {
  password: string
  onGenerate: () => void
}) {
  const strength = passwordStrength(password)
  const presentation = strengthPresentation[strength]
  return (
    <div className="space-y-3">
      <div aria-live="polite">
        <div className="h-1 overflow-hidden bg-muted">
          <div
            className={`h-full transition-[width,background-color] ${presentation.width} ${presentation.color}`}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {presentation.label} · щонайменше 12 символів
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onGenerate}
        className="h-9 rounded-sm"
      >
        <WandSparkles aria-hidden="true" />
        Згенерувати надійний пароль
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        Використовуйте великі й малі літери, цифри та спеціальні символи. Пароль
        не зберігається у відкритому вигляді.
      </p>
    </div>
  )
}

function hasGraphqlErrors(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'errors' in value
}
