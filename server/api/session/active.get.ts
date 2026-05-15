import { getActiveSessionWithSteps } from '../../utils/knowledge-store'

export default defineEventHandler(() => {
  return {
    activeSession: getActiveSessionWithSteps()
  }
})
