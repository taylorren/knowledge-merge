import { getMergeCardConceptPreview, type BranchSide } from '../../../utils/knowledge-store'

function normalizeBranch(value: unknown): BranchSide | null {
  if (value === 'left' || value === 'right') {
    return value
  }

  return null
}

export default defineEventHandler(event => {
  const idParam = getRouterParam(event, 'id')
  const mergeCardId = Number.parseInt(idParam ?? '', 10)
  const query = getQuery(event)
  const branch = normalizeBranch(query.branch)
  const stepIndex = Number.parseInt(String(query.stepIndex ?? ''), 10)

  if (!Number.isFinite(mergeCardId) || mergeCardId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid merge card id.' })
  }

  if (!branch) {
    throw createError({ statusCode: 400, statusMessage: 'branch must be either left or right.' })
  }

  if (!Number.isFinite(stepIndex) || stepIndex <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'stepIndex must be a positive integer.' })
  }

  const concept = getMergeCardConceptPreview({
    mergeCardId,
    branch,
    stepIndex
  })

  if (!concept) {
    throw createError({ statusCode: 404, statusMessage: 'Concept preview not found.' })
  }

  return {
    concept: {
      concept: concept.keyword,
      summary: concept.summary
    }
  }
})
