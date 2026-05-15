import { generateStepSummaryAndSuggestions } from '../../utils/ai-generation'
import { protectAiUsageEndpoint } from '../../utils/ai-access-guard'
import { addStepToActiveSession, startNewSession, type BranchSide } from '../../utils/knowledge-store'

interface StartSessionBody {
  leftTopic?: unknown
  rightTopic?: unknown
}
async function generateStepWithSuggestionRetry(input: {
  keyword: string
  branch: BranchSide
  branchTopic: string
  branchPath: string[]
}) {
  let generated = await generateStepSummaryAndSuggestions(input)
  if (generated.suggestions.length > 0) {
    return generated
  }

  generated = await generateStepSummaryAndSuggestions(input)
  return generated
}

export default defineEventHandler(async event => {
  protectAiUsageEndpoint(event)
  const body = await readBody<StartSessionBody>(event)
  const leftTopic = typeof body.leftTopic === 'string' ? body.leftTopic.trim() : ''
  const rightTopic = typeof body.rightTopic === 'string' ? body.rightTopic.trim() : ''

  if (!leftTopic || !rightTopic) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Both leftTopic and rightTopic are required.'
    })
  }

  try {
    let activeSession = startNewSession(leftTopic, rightTopic)

    const branches: BranchSide[] = ['left', 'right']
    for (const branch of branches) {
      const keyword = branch === 'left' ? leftTopic : rightTopic
      const branchTopic = branch === 'left' ? leftTopic : rightTopic
      const branchPath =
        branch === 'left'
          ? activeSession.leftSteps.map(step => step.keyword)
          : activeSession.rightSteps.map(step => step.keyword)
      const generated = await generateStepWithSuggestionRetry({
        keyword,
        branch,
        branchTopic,
        branchPath
      })

      activeSession = addStepToActiveSession({
        branch,
        keyword,
        summary: generated.summary,
        suggestions: generated.suggestions
      })
    }

    return {
      activeSession
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Failed to start session.'
    })
  }
})
