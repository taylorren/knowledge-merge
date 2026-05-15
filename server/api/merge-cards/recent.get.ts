import { listRecentMergeCards } from '../../utils/knowledge-store'

export default defineEventHandler(event => {
  const query = getQuery(event)
  const parsedLimit = Number.parseInt(String(query.limit ?? '10'), 10)
  const limit = Number.isNaN(parsedLimit) ? 10 : parsedLimit

  return {
    mergeCards: listRecentMergeCards(limit)
  }
})
