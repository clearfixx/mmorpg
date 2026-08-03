export type CommandResult<T> =
  { ok: true; data: T } | { ok: false; code: string }
