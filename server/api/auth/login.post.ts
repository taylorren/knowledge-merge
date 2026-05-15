import { signInWithPassword } from '../../utils/password-auth'

interface LoginBody {
  username?: unknown
  password?: unknown
}

export default defineEventHandler(async event => {
  const body = await readBody<LoginBody>(event)
  const username = typeof body.username === 'string' ? body.username : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!username.trim() || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Both username and password are required.'
    })
  }

  const authenticatedUsername = signInWithPassword(event, {
    username,
    password
  })

  return {
    auth: {
      configured: true,
      authenticated: true,
      username: authenticatedUsername
    }
  }
})
