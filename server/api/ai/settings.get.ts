import { getAiSettings } from '../../utils/knowledge-store'

export default defineEventHandler(() => {
  return {
    aiSettings: getAiSettings()
  }
})
