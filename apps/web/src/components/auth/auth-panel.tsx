'use client'

import { FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
      window.location.assign('/')
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
              <Input
                id={`${tab}-password`}
                name="password"
                type="password"
                autoComplete={
                  tab === 'login' ? 'current-password' : 'new-password'
                }
                required
                minLength={tab === 'register' ? 12 : 1}
                maxLength={128}
                className="h-12 rounded-sm bg-background/60"
              />
              {tab === 'register' && (
                <p className="text-xs leading-5 text-muted-foreground">
                  Щонайменше 12 символів. Пароль ніколи не зберігається у
                  відкритому вигляді.
                </p>
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

function hasGraphqlErrors(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'errors' in value
}
