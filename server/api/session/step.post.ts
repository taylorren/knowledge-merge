import { generateStepSummaryAndSuggestions } from '../../utils/ai-generation'
import {
  protectAiUsageForAuthenticatedUser,
  requireAuthenticatedWriteEndpoint
} from '../../utils/ai-access-guard'
import { addStepToActiveSession, getActiveSessionWithSteps, type BranchSide } from '../../utils/knowledge-store'

interface AddStepBody {
  branch?: unknown
  keyword?: unknown
  summary?: unknown
  suggestions?: unknown
}

function normalizeBranch(value: unknown): BranchSide | null {
  if (value === 'left' || value === 'right') {
    return value
  }

  return null
}

function normalizeSuggestions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 3)
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
  const username = requireAuthenticatedWriteEndpoint(event)
  const body = await readBody<AddStepBody>(event)
  const branch = normalizeBranch(body.branch)
  const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : ''
  const summary = typeof body.summary === 'string' ? body.summary.trim() : undefined
  const suggestions = normalizeSuggestions(body.suggestions)

  if (!branch) {
    throw createError({
      statusCode: 400,
      statusMessage: 'branch must be either "left" or "right".'
    })
  }

  if (!keyword) {
    throw createError({
      statusCode: 400,
      statusMessage: 'keyword is required.'
    })
  }

  try {
    let resolvedSummary = summary || undefined
    let resolvedSuggestions = suggestions
    const needsAiGeneration = !resolvedSummary || resolvedSuggestions.length === 0

    if (needsAiGeneration) {
      protectAiUsageForAuthenticatedUser(event, username, {
        scope: `session-step-${branch}`,
        fingerprint: keyword
      })
      const activeSession = getActiveSessionWithSteps()
      if (!activeSession) {
        throw new Error('No active session found. Start a new session first.')
      }
      const branchTopic =
        branch === 'left' ? activeSession.session.leftTopic : activeSession.session.rightTopic
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

      if (!resolvedSummary) {
        resolvedSummary = generated.summary
      }

      if (resolvedSuggestions.length === 0) {
        resolvedSuggestions = generated.suggestions
      }
    }
    return {
      activeSession: addStepToActiveSession({
        branch,
        keyword,
        summary: resolvedSummary,
        suggestions: resolvedSuggestions
      })
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Unable to add step.'
    })
  }
})
