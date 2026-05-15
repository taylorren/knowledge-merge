<template>
  <div class="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
    <UContainer class="py-10 sm:py-16">
      <div class="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
        <UCard class="border border-default/60 shadow-sm">
          <template #header>
            <div class="space-y-2">
              <UBadge color="primary" variant="soft" label="Knowledge Workspace" />
              <div>
                <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Knowledge Merges</h1>
                <p class="mt-2 text-sm text-muted">
                  Sign in to generate and merge concepts with a cleaner, focused workflow.
                </p>
              </div>
            </div>
          </template>

          <section v-if="isCheckingAuth">
            <USkeleton class="h-5 w-44" />
            <USkeleton class="mt-3 h-10 w-full" />
            <USkeleton class="mt-3 h-10 w-full" />
            <USkeleton class="mt-4 h-9 w-28" />
          </section>

          <section v-else class="space-y-5">
            <div class="space-y-1">
              <h2 class="text-lg font-medium">Sign in</h2>
              <p class="text-sm text-muted">Use your workspace credentials to continue.</p>
            </div>

            <form class="space-y-4" @submit.prevent="signIn">
              <UFormField label="Username" required>
                <UInput
                  v-model="loginForm.username"
                  required
                  autocomplete="username"
                  placeholder="jane.doe"
                  size="lg"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Password" required>
                <UInput
                  v-model="loginForm.password"
                  :type="isPasswordVisible ? 'text' : 'password'"
                  required
                  autocomplete="current-password"
                  placeholder="••••••••"
                  size="lg"
                  class="w-full"
                >
                  <template #trailing>
                    <UButton
                      type="button"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      :icon="isPasswordVisible ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                      :aria-label="isPasswordVisible ? 'Hide password' : 'Show password'"
                      @click="isPasswordVisible = !isPasswordVisible"
                    />
                  </template>
                </UInput>
              </UFormField>

              <UButton
                type="submit"
                :loading="isSigningIn"
                :disabled="!isAuthConfigured"
                label="Sign in"
                size="lg"
                class="w-full justify-center"
              />
            </form>

            <UAlert
              v-if="!isAuthConfigured"
              color="error"
              variant="soft"
              title="Server login is not configured"
              description="Set APP_AUTH_USERNAME and APP_AUTH_PASSWORD."
            />

            <UAlert v-if="errorMessage" color="error" variant="soft" :title="errorMessage" />
          </section>
        </UCard>

        <UCard class="border border-default/60 shadow-sm">
          <template #header>
            <h2 class="text-lg font-medium">Public archives</h2>
          </template>

          <div class="space-y-3">
            <p class="text-sm text-muted">
              Explore archived merge cards and previously published concept combinations.
            </p>
            <ul class="list-disc space-y-1 pl-4 text-sm text-toned">
              <li>Browse without signing in</li>
              <li>Open and review historical merges</li>
              <li>Share links to specific archive entries</li>
            </ul>
          </div>

          <template #footer>
            <UButton
              to="/archives"
              color="neutral"
              variant="subtle"
              label="Open archives"
              icon="i-lucide-arrow-right"
              trailing
            />
          </template>
        </UCard>
      </div>
    </UContainer>
  </div>
</template>

<script setup lang="ts">
interface AuthState {
  configured: boolean
  authenticated: boolean
  username: string | null
}

const authState = ref<AuthState | null>(null)
const errorMessage = ref('')
const isSigningIn = ref(false)
const isCheckingAuth = ref(true)
const isPasswordVisible = ref(false)

const loginForm = reactive({
  username: '',
  password: ''
})

const isAuthConfigured = computed(() => authState.value?.configured !== false)

async function refreshAuthState() {
  const response = await $fetch<{ auth: AuthState }>('/api/auth/session', {
    credentials: 'include'
  })
  authState.value = response.auth
}

async function initializeLoginPage() {
  errorMessage.value = ''
  isCheckingAuth.value = true
  try {
    await refreshAuthState()
    if (authState.value?.authenticated) {
      await navigateTo('/workspace')
      return
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to check authentication.'
  } finally {
    isCheckingAuth.value = false
  }
}

async function signIn() {
  errorMessage.value = ''
  if (!isAuthConfigured.value) {
    errorMessage.value = 'Server login is not configured.'
    return
  }

  isSigningIn.value = true
  try {
    const response = await $fetch<{ auth: AuthState }>('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      body: {
        username: loginForm.username,
        password: loginForm.password
      }
    })

    authState.value = response.auth
    loginForm.password = ''
    await navigateTo('/workspace')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Sign-in failed.'
  } finally {
    isSigningIn.value = false
  }
}

onMounted(() => {
  void initializeLoginPage()
})
</script>
