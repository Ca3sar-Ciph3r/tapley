// tests/server-action-exports.test.ts
//
// Guards a failure mode that neither `tsc` nor `next build` catches.
//
// A 'use server' module may only export async functions. Export a plain const
// from one and everything still type-checks and builds — but any client
// component importing it receives `undefined` at runtime. If that value is
// used at module scope, the page dies instantly with "Application error: a
// client-side exception has occurred".
//
// This shipped to production once: CHANGE_REQUEST_TYPES was exported from
// lib/actions/change-requests.ts, which broke both /admin/requests and
// /dashboard/requests. Constants that a client component needs to read belong
// in a plain module (see lib/constants/change-requests.ts).

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['lib', 'app', 'components']
const SOURCE_EXTENSIONS = /\.(ts|tsx)$/

function walk(dir: string): string[] {
  let out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out = out.concat(walk(full))
    } else if (SOURCE_EXTENSIONS.test(entry)) {
      out.push(full)
    }
  }
  return out
}

function isUseServerModule(source: string): boolean {
  // The directive must be the first statement, ignoring comments and blanks.
  for (const raw of source.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
      continue
    }
    return line === "'use server'" || line === '"use server"'
  }
  return false
}

/**
 * Exported bindings that survive to runtime. `interface` and `type` are erased
 * by the compiler, so they are safe to export from a 'use server' file.
 */
function runtimeValueExports(source: string): string[] {
  const found: string[] = []
  const declaration = /^export\s+(const|let|var|class|enum)\s+([A-Za-z0-9_$]+)/gm
  for (const m of source.matchAll(declaration)) found.push(m[2])

  // `export { X }` re-exports a value just as effectively. Bare `export type
  // { X }` is erased, so it is excluded.
  const named = /^export\s+\{([^}]*)\}/gm
  for (const m of source.matchAll(named)) {
    for (const part of m[1].split(',')) {
      const name = part.trim()
      if (name && !name.startsWith('type ')) found.push(name.split(/\s+as\s+/)[0])
    }
  }
  return found
}

describe('use server modules', () => {
  const files = ROOTS.flatMap(r => walk(r))
  const serverModules = files.filter(f => isUseServerModule(readFileSync(f, 'utf8')))

  it('finds the server action modules to check', () => {
    // A path or extension change that silently matched nothing would make every
    // assertion below vacuously pass.
    expect(serverModules.length).toBeGreaterThan(0)
  })

  it.each(serverModules)('%s exports only async functions', file => {
    const offenders = runtimeValueExports(readFileSync(file, 'utf8'))
    expect(
      offenders,
      `${file} exports ${offenders.join(', ')} from a 'use server' module. ` +
        `Client components importing these get undefined at runtime. ` +
        `Move them to a plain module, e.g. lib/constants/.`
    ).toEqual([])
  })
})
