import { getAuthenticatedUsername, isPasswordAuthConfigured } from '../../utils/password-auth'

export default defineEventHandler(event => {
  const configured = isPasswordAuthConfigured()
  const username = configured ? getAuthenticatedUsername(event) : null

  return {
    auth: {
      configured,
      authenticated: Boolean(username),
      username
    }
  }
})
