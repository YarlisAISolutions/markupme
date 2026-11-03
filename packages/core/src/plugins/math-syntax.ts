/**
 * Math syntax for micromark (`$$` flow math and `$` text math), ported to TypeScript from
 * micromark-extension-math 3.1.0 (`lib/syntax.js`, `lib/math-flow.js`, `lib/math-text.js`).
 * Copyright (c) 2020 Titus Wormer <tituswormer@gmail.com>, MIT; full notice in THIRD-PARTY-NOTICES.md.
 * https://github.com/micromark/micromark-extension-math
 *
 * Why it lives here: micromark-extension-math (and remark-math, which depends on it) declares
 * `katex ^0.16.0` for its HTML compiler, which MarkupMe never uses. npm ignores our root
 * `overrides` for installed packages, so depending on it gave every consumer a vulnerable
 * KaTeX (GHSA-238p-pmpm-9mq7, MKP-7). Only the tokenizers are ported; behaviour is unchanged.
 */
import { factorySpace } from 'micromark-factory-space'
import { markdownLineEnding } from 'micromark-util-character'
import type {
  Code,
  Construct,
  Effects,
  Event,
  Extension,
  Previous,
  Resolver,
  State,
  TokenizeContext,
} from 'micromark-util-types'

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    mathFlow: 'mathFlow'
    mathFlowFence: 'mathFlowFence'
    mathFlowFenceMeta: 'mathFlowFenceMeta'
    mathFlowFenceSequence: 'mathFlowFenceSequence'
    mathFlowValue: 'mathFlowValue'
    mathText: 'mathText'
    mathTextData: 'mathTextData'
    mathTextPadding: 'mathTextPadding'
    mathTextSequence: 'mathTextSequence'
  }
}

const DOLLAR = 36
const SPACE = 32

export interface MathSyntaxOptions {
  /** Whether `$x$` (one dollar) is text math. Default `true`. */
  singleDollarTextMath?: boolean | null | undefined
}

/** micromark extension for math syntax. */
export function mathSyntax(options?: MathSyntaxOptions | null): Extension {
  return {
    flow: { [DOLLAR]: mathFlow },
    text: { [DOLLAR]: mathText(options) },
  }
}

// ---------------------------------------------------------------------------------------------
// Flow math: $$ … $$

const mathFlow: Construct = {
  tokenize: tokenizeMathFenced,
  concrete: true,
  name: 'mathFlow',
}

const nonLazyContinuation: Construct = {
  tokenize: tokenizeNonLazyContinuation,
  partial: true,
}

function tokenizeMathFenced(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
  const self = this
  const tail = self.events[self.events.length - 1]
  const initialSize =
    tail && tail[1].type === 'linePrefix' ? tail[2].sliceSerialize(tail[1], true).length : 0
  let sizeOpen = 0
  return start

  function start(code: Code): State | undefined {
    effects.enter('mathFlow')
    effects.enter('mathFlowFence')
    effects.enter('mathFlowFenceSequence')
    return sequenceOpen(code)
  }

  function sequenceOpen(code: Code): State | undefined {
    if (code === DOLLAR) {
      effects.consume(code)
      sizeOpen++
      return sequenceOpen
    }
    if (sizeOpen < 2) return nok(code)
    effects.exit('mathFlowFenceSequence')
    return factorySpace(effects, metaBefore, 'whitespace')(code)
  }

  function metaBefore(code: Code): State | undefined {
    if (code === null || markdownLineEnding(code)) return metaAfter(code)
    effects.enter('mathFlowFenceMeta')
    effects.enter('chunkString', { contentType: 'string' })
    return meta(code)
  }

  function meta(code: Code): State | undefined {
    if (code === null || markdownLineEnding(code)) {
      effects.exit('chunkString')
      effects.exit('mathFlowFenceMeta')
      return metaAfter(code)
    }
    if (code === DOLLAR) return nok(code)
    effects.consume(code)
    return meta
  }

  function metaAfter(code: Code): State | undefined {
    effects.exit('mathFlowFence')
    if (self.interrupt) return ok(code)
    return effects.attempt(nonLazyContinuation, beforeNonLazyContinuation, after)(code)
  }

  function beforeNonLazyContinuation(code: Code): State | undefined {
    return effects.attempt(
      { tokenize: tokenizeClosingFence, partial: true },
      after,
      contentStart,
    )(code)
  }

  function contentStart(code: Code): State | undefined {
    return (
      initialSize
        ? factorySpace(effects, beforeContentChunk, 'linePrefix', initialSize + 1)
        : beforeContentChunk
    )(code)
  }

  function beforeContentChunk(code: Code): State | undefined {
    if (code === null) return after(code)
    if (markdownLineEnding(code)) {
      return effects.attempt(nonLazyContinuation, beforeNonLazyContinuation, after)(code)
    }
    effects.enter('mathFlowValue')
    return contentChunk(code)
  }

  function contentChunk(code: Code): State | undefined {
    if (code === null || markdownLineEnding(code)) {
      effects.exit('mathFlowValue')
      return beforeContentChunk(code)
    }
    effects.consume(code)
    return contentChunk
  }

  function after(code: Code): State | undefined {
    effects.exit('mathFlow')
    return ok(code)
  }

  function tokenizeClosingFence(
    this: TokenizeContext,
    effects: Effects,
    ok: State,
    nok: State,
  ): State {
    let size = 0
    return factorySpace(
      effects,
      beforeSequenceClose,
      'linePrefix',
      self.parser.constructs.disable.null?.includes('codeIndented') ? undefined : 4,
    )

    function beforeSequenceClose(code: Code): State | undefined {
      effects.enter('mathFlowFence')
      effects.enter('mathFlowFenceSequence')
      return sequenceClose(code)
    }

    function sequenceClose(code: Code): State | undefined {
      if (code === DOLLAR) {
        size++
        effects.consume(code)
        return sequenceClose
      }
      if (size < sizeOpen) return nok(code)
      effects.exit('mathFlowFenceSequence')
      return factorySpace(effects, afterSequenceClose, 'whitespace')(code)
    }

    function afterSequenceClose(code: Code): State | undefined {
      if (code === null || markdownLineEnding(code)) {
        effects.exit('mathFlowFence')
        return ok(code)
      }
      return nok(code)
    }
  }
}

function tokenizeNonLazyContinuation(
  this: TokenizeContext,
  effects: Effects,
  ok: State,
  nok: State,
): State {
  const self = this
  return start

  function start(code: Code): State | undefined {
    if (code === null) return ok(code)
    effects.enter('lineEnding')
    effects.consume(code)
    effects.exit('lineEnding')
    return lineStart
  }

  function lineStart(code: Code): State | undefined {
    return self.parser.lazy[self.now().line] ? nok(code) : ok(code)
  }
}

// ---------------------------------------------------------------------------------------------
// Text math: $ … $ and $$ … $$ inline

function mathText(options?: MathSyntaxOptions | null): Construct {
  let single = options?.singleDollarTextMath
  if (single === null || single === undefined) single = true

  return {
    tokenize: tokenizeMathText,
    resolve: resolveMathText,
    previous,
    name: 'mathText',
  }

  function tokenizeMathText(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
    let sizeOpen = 0
    let size = 0
    let token: ReturnType<typeof effects.enter> | undefined
    return start

    function start(code: Code): State | undefined {
      effects.enter('mathText')
      effects.enter('mathTextSequence')
      return sequenceOpen(code)
    }

    function sequenceOpen(code: Code): State | undefined {
      if (code === DOLLAR) {
        effects.consume(code)
        sizeOpen++
        return sequenceOpen
      }
      if (sizeOpen < 2 && !single) return nok(code)
      effects.exit('mathTextSequence')
      return between(code)
    }

    function between(code: Code): State | undefined {
      if (code === null) return nok(code)
      if (code === DOLLAR) {
        token = effects.enter('mathTextSequence')
        size = 0
        return sequenceClose(code)
      }
      if (code === SPACE) {
        effects.enter('space')
        effects.consume(code)
        effects.exit('space')
        return between
      }
      if (markdownLineEnding(code)) {
        effects.enter('lineEnding')
        effects.consume(code)
        effects.exit('lineEnding')
        return between
      }
      effects.enter('mathTextData')
      return data(code)
    }

    function data(code: Code): State | undefined {
      if (code === null || code === SPACE || code === DOLLAR || markdownLineEnding(code)) {
        effects.exit('mathTextData')
        return between(code)
      }
      effects.consume(code)
      return data
    }

    function sequenceClose(code: Code): State | undefined {
      if (code === DOLLAR) {
        effects.consume(code)
        size++
        return sequenceClose
      }
      if (size === sizeOpen) {
        effects.exit('mathTextSequence')
        effects.exit('mathText')
        return ok(code)
      }
      // More or fewer dollars than the opening sequence: it is data.
      if (token) token.type = 'mathTextData'
      return data(code)
    }
  }
}

const resolveMathText: Resolver = (events: Event[]) => {
  let tailExitIndex = events.length - 4
  let headEnterIndex = 3
  let index: number
  let enter: number | undefined

  const at = (i: number) => (events[i] as Event)[1]

  // A space or line ending on both sides of data is padding.
  if (
    (at(headEnterIndex).type === 'lineEnding' || at(headEnterIndex).type === 'space') &&
    (at(tailExitIndex).type === 'lineEnding' || at(tailExitIndex).type === 'space')
  ) {
    index = headEnterIndex
    while (++index < tailExitIndex) {
      if (at(index).type === 'mathTextData') {
        at(tailExitIndex).type = 'mathTextPadding'
        at(headEnterIndex).type = 'mathTextPadding'
        headEnterIndex += 2
        tailExitIndex -= 2
        break
      }
    }
  }

  // Merge adjacent spaces and data.
  index = headEnterIndex - 1
  tailExitIndex++
  while (++index <= tailExitIndex) {
    if (enter === undefined) {
      if (index !== tailExitIndex && at(index).type !== 'lineEnding') enter = index
    } else if (index === tailExitIndex || at(index).type === 'lineEnding') {
      at(enter).type = 'mathTextData'
      if (index !== enter + 2) {
        at(enter).end = at(index - 1).end
        events.splice(enter + 2, index - enter - 2)
        tailExitIndex -= index - enter - 2
        index = enter + 2
      }
      enter = undefined
    }
  }

  return events
}

const previous: Previous = function (this: TokenizeContext, code: Code): boolean {
  // If there is a previous code, there will always be a tail.
  return (
    code !== DOLLAR || (this.events[this.events.length - 1] as Event)[1].type === 'characterEscape'
  )
}
