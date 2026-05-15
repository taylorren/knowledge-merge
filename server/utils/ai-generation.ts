import {
  getAiSettingsWithSecret,
  LOCAL_OLLAMA_BASE_URI,
  LOCAL_OLLAMA_MODEL
} from './knowledge-store'

interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

interface StepGenerationInput {
  keyword: string
  branch: 'left' | 'right'
  branchTopic: string
  branchPath: string[]
}

interface MergeNarrativeInput {
  mergedConcept: string
  leftTopic: string
  rightTopic: string
  leftPath: string[]
  rightPath: string[]
}

function buildCloudCompletionsUrl(baseUri: string): string {
  const trimmed = baseUri.trim().replace(/\/+$/, '')

  if (!trimmed) {
    throw new Error('Cloud base URI is empty.')
  }

  if (trimmed.endsWith('/chat/completions')) {
    return trimmed
  }

  if (trimmed.endsWith('/v1')) {
    return `${trimmed}/chat/completions`
  }

  return `${trimmed}/v1/chat/completions`
}

function parseJsonObject<T>(raw: string): T {
  const direct = raw.trim()

  try {
    return JSON.parse(direct) as T
  } catch {
    const start = direct.indexOf('{')
    const end = direct.lastIndexOf('}')

    if (start >= 0 && end > start) {
      const sliced = direct.slice(start, end + 1)
      return JSON.parse(sliced) as T
    }
  }

  throw new Error('AI response was not valid JSON.')
}

function normalizeSuggestions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(item => typeof item === 'string')
    .map(item => normalizeSuggestionKeyword(item))
    .filter(Boolean)
    .slice(0, 3)
}

function normalizeSuggestionKeyword(raw: string): string {
  const withoutPrefix = raw
    .trim()
    .replace(/^next\s*keyword\s*[:：-]\s*/i, '')
    .trim()
  const firstToken = withoutPrefix.split(/\s+/)[0] ?? ''
  const cleaned = firstToken
    .replace(/^[^\p{L}\p{N}_-]+|[^\p{L}\p{N}_-]+$/gu, '')
    .toLowerCase()

  if (!cleaned || !/^\p{L}[\p{L}-]*$/u.test(cleaned)) {
    return ''
  }

  const bannedGenericWords = new Set([
    'keyword',
    'topic',
    'concept',
    'idea',
    'thing',
    'stuff',
    'object',
    'item',
    'aspect',
    'element',
    'factor',
    'process',
    'method'
  ])

  if (bannedGenericWords.has(cleaned)) {
    return ''
  }

  return cleaned
}

async function requestJsonFromLocal<T>(messages: ChatMessage[]): Promise<T> {
  const response = await fetch(`${LOCAL_OLLAMA_BASE_URI}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: LOCAL_OLLAMA_MODEL,
      stream: false,
      format: 'json',
      messages
    })
  })

  if (!response.ok) {
    throw new Error(`Local Ollama request failed (${response.status}).`)
  }

  const payload = (await response.json()) as {
    message?: {
      content?: string
    }
  }

  const content = payload.message?.content
  if (!content) {
    throw new Error('Local Ollama returned an empty response.')
  }

  return parseJsonObject<T>(content)
}

async function requestJsonFromCloud<T>(
  messages: ChatMessage[],
  input: { baseUri: string; apiKey: string; model: string }
): Promise<T> {
  const endpoint = buildCloudCompletionsUrl(input.baseUri)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 0.3,
      messages
    })
  })

  if (!response.ok) {
    throw new Error(`Cloud AI request failed (${response.status}).`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ text?: string }>
      }
    }>
  }

  const firstContent = payload.choices?.[0]?.message?.content
  const content =
    typeof firstContent === 'string'
      ? firstContent
      : Array.isArray(firstContent)
      ? firstContent
          .map(part => (typeof part?.text === 'string' ? part.text : ''))
          .join('\n')
      : ''

  if (!content) {
    throw new Error('Cloud AI returned an empty response.')
  }

  return parseJsonObject<T>(content)
}

async function requestJsonFromActiveProvider<T>(messages: ChatMessage[]): Promise<T> {
  const settings = getAiSettingsWithSecret()

  if (settings.activeProvider === 'local') {
    if (!settings.localBaseUri || !settings.localModel) {
      throw new Error('Local provider is active but LOCAL_OLLAMA_BASE_URI/LOCAL_OLLAMA_MODEL are not configured.')
    }
    return requestJsonFromLocal<T>(messages)
  }

  if (!settings.cloudBaseUri || !settings.cloudModel || !settings.cloudApiKey) {
    throw new Error('Cloud provider is active but not fully configured.')
  }

  return requestJsonFromCloud<T>(messages, {
    baseUri: settings.cloudBaseUri,
    apiKey: settings.cloudApiKey,
    model: settings.cloudModel
  })
}

export async function generateStepSummaryAndSuggestions(input: StepGenerationInput): Promise<{
  summary: string
  suggestions: string[]
}> {
  const branchPath = input.branchPath.length ? input.branchPath.join(' -> ') : '(none yet)'

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are familiar with many aspects and hold a general understanding of a conecpt. You will generate concise, plain-language learning scaffolds. Always respond with strict JSON.'
    },
    {
      role: 'user',
      content: [
        `Branch: ${input.branch}`,
        `Branch root topic: ${input.branchTopic}`,
        `Current branch path: ${branchPath}`,
        `New keyword: ${input.keyword}`,
        'Each suggestion must be exactly one word (no spaces), and should be a concrete, singular noun of an object, a conecpt.',
        'Do not return generic words like concept/topic/idea/process.',
        'Return strict JSON only with this shape:',
        '{"summary":"one concise paragraph under 150 words","suggestions":["singleword1","singleword2","singleword3"]}'
      ].join('\n')
    }
  ]

  const generated = await requestJsonFromActiveProvider<{
    summary?: unknown
    suggestions?: unknown
  }>(messages)

  const summary =
    typeof generated.summary === 'string' && generated.summary.trim()
      ? generated.summary.trim()
      : `Summary pending generation for "${input.keyword}".`

  const suggestions = normalizeSuggestions(generated.suggestions)
  return {
    summary,
    suggestions
  }
}

export async function generateMergeNarrative(input: MergeNarrativeInput): Promise<string> {
  const leftPath = input.leftPath.length ? input.leftPath.join(' -> ') : '(none yet)'
  const rightPath = input.rightPath.length ? input.rightPath.join(' -> ') : '(none yet)'

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You explain conceptual convergence clearly for non-experts. Always respond with strict JSON.'
    },
    {
      role: 'user',
      content: [
        `Left topic: ${input.leftTopic}`,
        `Right topic: ${input.rightTopic}`,
        `Left path: ${leftPath}`,
        `Right path: ${rightPath}`,
        `Merged concept: ${input.mergedConcept}`,
        'Return strict JSON only with this shape:',
        '{"narrative":"2-4 sentence explanation of how the branches converge"}'
      ].join('\n')
    }
  ]

  const generated = await requestJsonFromActiveProvider<{ narrative?: unknown }>(messages)
  const narrative =
    typeof generated.narrative === 'string' && generated.narrative.trim()
      ? generated.narrative.trim()
      : `The branches converge at "${input.mergedConcept}" through related mechanisms and shared principles.`

  return narrative
}
