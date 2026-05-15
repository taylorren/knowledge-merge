import { type AiProvider, updateAiSettings } from '../../utils/knowledge-store'

interface UpdateAiSettingsBody {
  activeProvider?: unknown
}

function normalizeActiveProvider(value: unknown): AiProvider | undefined {
  if (value === 'local' || value === 'cloud') {
    return value
  }

  return undefined
}

export default defineEventHandler(async event => {
  const body = await readBody<UpdateAiSettingsBody>(event)
  const activeProvider = normalizeActiveProvider(body.activeProvider)

  if (body.activeProvider !== undefined && !activeProvider) {
    throw createError({
      statusCode: 400,
      statusMessage: 'activeProvider must be either "local" or "cloud".'
    })
  }

  try {
    return {
      aiSettings: updateAiSettings({
        activeProvider
      })
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Unable to update AI settings.'
    })
  }
})
