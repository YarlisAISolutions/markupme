/** What to show after activation. Kept free of `vscode` so it can be tested. */

export const WALKTHROUGH_ID = 'yarlis.markupme-vscode#markupme.gettingStarted'

/** The globalState key that remembers the last version the user ran. */
export const LAST_VERSION_KEY = 'markupme.lastVersion'

export type Greeting = 'welcome' | 'whatsNew' | 'none'

function majorMinor(v: string): [number, number] | undefined {
  const m = /^(\d+)\.(\d+)\./.exec(v)
  return m ? [Number(m[1]), Number(m[2])] : undefined
}

/**
 * `welcome` on the first run, `whatsNew` when the major or minor version went up (patches are
 * quiet), otherwise `none`. Never shows the same greeting twice: the caller stores `current`.
 */
export function greeting(previous: string | undefined, current: string, whatsNew = true): Greeting {
  if (previous === undefined) return 'welcome'
  if (!whatsNew || previous === current) return 'none'
  const a = majorMinor(previous)
  const b = majorMinor(current)
  if (!a || !b) return 'none'
  return b[0] > a[0] || (b[0] === a[0] && b[1] > a[1]) ? 'whatsNew' : 'none'
}
