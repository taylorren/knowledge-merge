import { generateMergeNarrative } from '../../utils/ai-generation'
import { protectAiUsageEndpoint } from '../../utils/ai-access-guard'
import { declareMergeForActiveSession, getActiveSessionWithSteps } from '../../utils/knowledge-store'

interface MergeBody {
  mergedConcept?: unknown
  narrative?: unknown
}

export default defineEventHandler(async event => {
  protectAiUsageEndpoint(event)
  const body = await readBody<MergeBody>(event)
  const mergedConcept = typeof body.mergedConcept === 'string' ? body.mergedConcept.trim() : ''
  const narrative = typeof body.narrative === 'string' ? body.narrative.trim() : undefined

  if (!mergedConcept) {
    throw createError({
      statusCode: 400,
      statusMessage: 'mergedConcept is required.'
    })
  }

  try {
    let resolvedNarrative = narrative
    if (!resolvedNarrative) {
      const activeSession = getActiveSessionWithSteps()
      if (!activeSession) {
        throw new Error('No active session found. Start a new session first.')
      }

      resolvedNarrative = await generateMergeNarrative({
        mergedConcept,
        leftTopic: activeSession.session.leftTopic,
        rightTopic: activeSession.session.rightTopic,
        leftPath: activeSession.leftSteps.map(step => step.keyword),
        rightPath: activeSession.rightSteps.map(step => step.keyword)
      })
    }
    return {
      mergeCard: declareMergeForActiveSession({ mergedConcept, narrative: resolvedNarrative })
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Unable to declare merge.'
    })
  }
})
