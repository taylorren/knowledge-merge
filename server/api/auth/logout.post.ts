import { isPasswordAuthConfigured, signOut } from '../../utils/password-auth'

export default defineEventHandler(event => {
  signOut(event)

  return {
    auth: {
      configured: isPasswordAuthConfigured(),
      authenticated: false,
      username: null
    }
  }
})
