<template>
  <div class="page">
    <main class="container">
      <header class="header">
        <div class="header-top-row">
          <div class="welcome-block">
            <h1>{{ welcomeText }}</h1>
            <p class="mission-tagline">
              Our mission: connect ideas, surface insights, and help you build meaningful knowledge merges.
            </p>
          </div>
          <div v-if="!isCheckingAccess" class="header-actions">
            <NuxtLink class="archive-link" to="/archives">Open Archives</NuxtLink>
            <button class="signout-button" :disabled="isSigningOut" type="button" @click="signOut">
              {{ isSigningOut ? 'Signing out...' : 'Sign Out' }}
            </button>
          </div>
        </div>
      </header>

      <section v-if="isCheckingAccess" class="card">
        <p class="muted">Checking session...</p>
      </section>

      <template v-else>

        <section class="card">
          <h2>Model</h2>
          <label class="switch-row">
            <span>Remote AI</span>
            <input v-model="useCloudProvider" :disabled="isUpdatingProvider" type="checkbox" />
            <span>{{ useCloudProvider ? 'On' : 'Off' }}</span>
          </label>
          <p class="muted">Current model: <strong>{{ activeModelName }}</strong></p>
          <p v-if="isUpdatingProvider" class="muted">Updating provider...</p>
        </section>

        <section class="card">
          <h2>Start a session</h2>
          <form class="form-grid" @submit.prevent="startSession">
            <label>
              Left topic
              <input v-model="startForm.leftTopic" required placeholder="e.g. Neural networks" />
            </label>
            <label>
              Right topic
              <input v-model="startForm.rightTopic" required placeholder="e.g. Renaissance art" />
            </label>
            <button :disabled="isSubmittingStart" type="submit">
              {{ isSubmittingStart ? 'Starting...' : 'Start new session' }}
            </button>
          </form>
        </section>

        <section v-if="activeSession" class="card">
          <h2>Session branches</h2>
          <div class="branches-layout">
            <section class="branch-column">
              <h3>Left branch</h3>
              <div class="branch-stack">
                <article v-for="step in getBranchSteps('left')" :key="step.id" class="branch-card">
                  <p class="muted">Topic</p>
                  <p class="topic-value">{{ step.keyword }}</p>
                  <p class="muted">AI output</p>
                  <p class="summary-text">{{ step.summary }}</p>

                  <div class="next-layout">
                    <p class="muted">Suggested next topics</p>
                    <ul class="suggestions">
                      <li v-for="suggestion in step.suggestions" :key="`left-${step.id}-${suggestion}`">
                        <button
                          v-if="isLatestStep('left', step.id)"
                          class="suggestion-button"
                          type="button"
                          @click="setBranchChoice('left', suggestion)"
                        >
                          {{ cleanSuggestion(suggestion) }}
                        </button>
                        <span v-else class="suggestion-chip">{{ cleanSuggestion(suggestion) }}</span>
                      </li>
                      <li v-if="!step.suggestions.length" class="muted">
                        No suggestions available yet.
                      </li>
                    </ul>

                    <form
                      v-if="isLatestStep('left', step.id)"
                      class="choice-row"
                      @submit.prevent="continueBranch('left')"
                    >
                      <input
                        v-model="branchChoice.left"
                        placeholder="Your pick"
                        required
                      />
                      <button :disabled="isSubmittingBranch.left" type="submit">
                        {{ isSubmittingBranch.left ? 'Continuing...' : 'Continue' }}
                      </button>
                    </form>
                    <div v-else class="muted">Historical step</div>
                  </div>
                </article>
                <article v-if="!getBranchSteps('left').length" class="branch-card">
                  <p class="muted">No left-branch steps yet.</p>
                </article>
              </div>
            </section>

            <section class="branch-column">
              <h3>Right branch</h3>
              <div class="branch-stack">
                <article v-for="step in getBranchSteps('right')" :key="step.id" class="branch-card">
                  <p class="muted">Topic</p>
                  <p class="topic-value">{{ step.keyword }}</p>
                  <p class="muted">AI output</p>
                  <p class="summary-text">{{ step.summary }}</p>

                  <div class="next-layout">
                    <p class="muted">Suggested next topics</p>
                    <ul class="suggestions">
                      <li v-for="suggestion in step.suggestions" :key="`right-${step.id}-${suggestion}`">
                        <button
                          v-if="isLatestStep('right', step.id)"
                          class="suggestion-button"
                          type="button"
                          @click="setBranchChoice('right', suggestion)"
                        >
                          {{ cleanSuggestion(suggestion) }}
                        </button>
                        <span v-else class="suggestion-chip">{{ cleanSuggestion(suggestion) }}</span>
                      </li>
                      <li v-if="!step.suggestions.length" class="muted">
                        No suggestions available yet.
                      </li>
                    </ul>

                    <form
                      v-if="isLatestStep('right', step.id)"
                      class="choice-row"
                      @submit.prevent="continueBranch('right')"
                    >
                      <input
                        v-model="branchChoice.right"
                        placeholder="Your pick"
                        required
                      />
                      <button :disabled="isSubmittingBranch.right" type="submit">
                        {{ isSubmittingBranch.right ? 'Continuing...' : 'Continue' }}
                      </button>
                    </form>
                    <div v-else class="muted">Historical step</div>
                  </div>
                </article>
                <article v-if="!getBranchSteps('right').length" class="branch-card">
                  <p class="muted">No right-branch steps yet.</p>
                </article>
              </div>
            </section>
          </div>

          <div class="merge-card">
            <h3>Declare merge</h3>
            <form class="stack" @submit.prevent="declareMerge">
              <input v-model="mergeForm.mergedConcept" placeholder="Merged concept" required />
              <textarea
                v-model="mergeForm.narrative"
                placeholder="Optional: how both branches converge (leave blank for AI)"
                rows="3"
              />
              <button :disabled="isSubmittingMerge" type="submit">
                {{ isSubmittingMerge ? 'Saving...' : 'Complete and archive merge' }}
              </button>
            </form>
          </div>
        </section>

        <section v-else class="card">
          <h2>No active session</h2>
          <p class="muted">Start one above to generate both branch cards.</p>
        </section>
      </template>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    </main>
  </div>
</template>

<script setup lang="ts">
type BranchSide = 'left' | 'right'

interface BranchStep {
  id: number
  branch: BranchSide
  stepIndex: number
  keyword: string
  summary: string
  suggestions: string[]
}

interface ActiveSessionPayload {
  session: {
    id: number
    leftTopic: string
    rightTopic: string
    status: 'active' | 'merged' | 'abandoned'
  }
  leftSteps: BranchStep[]
  rightSteps: BranchStep[]
}

interface AiSettings {
  activeProvider: 'local' | 'cloud'
  localBaseUri: string
  localModel: string
  cloudBaseUri: string
  cloudModel: string
  hasCloudApiKey: boolean
}

interface AuthState {
  configured: boolean
  authenticated: boolean
  username: string | null
}

interface MaybeHttpError {
  statusCode?: number
  status?: number
  response?: {
    status?: number
  }
}

const activeSession = ref<ActiveSessionPayload | null>(null)
const aiSettings = ref<AiSettings | null>(null)
const authState = ref<AuthState | null>(null)
const errorMessage = ref('')
const isCheckingAccess = ref(true)
const isSigningOut = ref(false)

const startForm = reactive({
  leftTopic: '',
  rightTopic: ''
})

const branchChoice = reactive({
  left: '',
  right: ''
})

const mergeForm = reactive({
  mergedConcept: '',
  narrative: ''
})

const isSubmittingStart = ref(false)
const isSubmittingMerge = ref(false)
const isUpdatingProvider = ref(false)
const isSubmittingBranch = reactive({
  left: false,
  right: false
})

const isAuthenticated = computed(() => authState.value?.authenticated === true)
const authenticatedUsername = computed(() => authState.value?.username ?? '')
const welcomeText = computed(() =>
  authenticatedUsername.value
    ? `Knowledge Merges Welcomes you, ${authenticatedUsername.value}`
    : 'Knowledge Merges'
)

const useCloudProvider = computed({
  get: () => aiSettings.value?.activeProvider === 'cloud',
  set: value => {
    if (!requireSignedInAction()) {
      return
    }
    void setActiveProvider(value ? 'cloud' : 'local')
  }
})

const activeModelName = computed(() => {
  if (!aiSettings.value) {
    return '(loading...)'
  }

  return aiSettings.value.activeProvider === 'cloud'
    ? aiSettings.value.cloudModel || '(cloud model not configured)'
    : aiSettings.value.localModel
})

function getBranchSteps(branch: BranchSide): BranchStep[] {
  if (!activeSession.value) {
    return []
  }

  return branch === 'left' ? activeSession.value.leftSteps : activeSession.value.rightSteps
}

function isLatestStep(branch: BranchSide, stepId: number): boolean {
  const steps = getBranchSteps(branch)
  return Boolean(steps.length && steps[steps.length - 1]?.id === stepId)
}

function cleanSuggestion(suggestion: string): string {
  const withoutPrefix = suggestion.replace(/^next\s*keyword\s*[:：-]\s*/i, '').trim()
  const firstToken = withoutPrefix.split(/\s+/)[0] ?? ''
  return firstToken.replace(/^[^\p{L}\p{N}_-]+|[^\p{L}\p{N}_-]+$/gu, '')
}

function setBranchChoice(branch: BranchSide, suggestion: string) {
  branchChoice[branch] = cleanSuggestion(suggestion)
}

async function refreshAuthState() {
  const response = await $fetch<{ auth: AuthState }>('/api/auth/session', {
    credentials: 'include'
  })
  authState.value = response.auth
}

async function refreshActiveSession() {
  const response = await $fetch<{ activeSession: ActiveSessionPayload | null }>('/api/session/active')
  activeSession.value = response.activeSession
}

async function refreshAiSettings() {
  const response = await $fetch<{ aiSettings: AiSettings }>('/api/ai/settings')
  aiSettings.value = response.aiSettings
}

function requireSignedInAction(): boolean {
  if (isAuthenticated.value) {
    return true
  }

  errorMessage.value = 'Your session has expired. Please sign in again.'
  void navigateTo('/')
  return false
}

function extractStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null
  }

  const maybeHttpError = error as MaybeHttpError
  return maybeHttpError.statusCode ?? maybeHttpError.status ?? maybeHttpError.response?.status ?? null
}

async function handleProtectedActionError(error: unknown, fallbackMessage: string) {
  if (extractStatusCode(error) === 401) {
    await refreshAuthState()
    errorMessage.value = 'Your session has expired. Please sign in again.'
    await navigateTo('/')
    return
  }

  errorMessage.value = error instanceof Error ? error.message : fallbackMessage
}

async function initializeWorkspace() {
  errorMessage.value = ''
  isCheckingAccess.value = true
  try {
    await refreshAuthState()
    if (!isAuthenticated.value) {
      await navigateTo('/')
      return
    }

    await Promise.all([refreshActiveSession(), refreshAiSettings()])
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load workspace.'
  } finally {
    isCheckingAccess.value = false
  }
}

async function signOut() {
  errorMessage.value = ''
  isSigningOut.value = true
  try {
    await $fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    })

    await navigateTo('/')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Sign-out failed.'
  } finally {
    isSigningOut.value = false
  }
}

async function setActiveProvider(activeProvider: 'local' | 'cloud') {
  if (!requireSignedInAction()) {
    return
  }
  errorMessage.value = ''
  isUpdatingProvider.value = true
  try {
    const response = await $fetch<{ aiSettings: AiSettings }>('/api/ai/settings', {
      method: 'POST',
      credentials: 'include',
      body: {
        activeProvider
      }
    })
    aiSettings.value = response.aiSettings
  } catch (error) {
    await handleProtectedActionError(error, 'Failed to save AI settings.')
    await refreshAiSettings()
  } finally {
    isUpdatingProvider.value = false
  }
}

async function startSession() {
  if (!requireSignedInAction()) {
    return
  }
  errorMessage.value = ''
  isSubmittingStart.value = true
  try {
    const response = await $fetch<{ activeSession: ActiveSessionPayload }>('/api/session/start', {
      method: 'POST',
      credentials: 'include',
      body: {
        leftTopic: startForm.leftTopic,
        rightTopic: startForm.rightTopic
      }
    })

    activeSession.value = response.activeSession
    startForm.leftTopic = ''
    startForm.rightTopic = ''
    branchChoice.left = ''
    branchChoice.right = ''
  } catch (error) {
    await handleProtectedActionError(error, 'Failed to start session.')
  } finally {
    isSubmittingStart.value = false
  }
}

async function continueBranch(branch: BranchSide) {
  if (!requireSignedInAction()) {
    return
  }
  errorMessage.value = ''
  const keyword = branchChoice[branch].trim()
  if (!keyword) {
    errorMessage.value = 'Please provide a next topic choice.'
    return
  }

  isSubmittingBranch[branch] = true
  try {
    const response = await $fetch<{ activeSession: ActiveSessionPayload }>('/api/session/step', {
      method: 'POST',
      credentials: 'include',
      body: {
        branch,
        keyword
      }
    })

    activeSession.value = response.activeSession
    branchChoice[branch] = ''
  } catch (error) {
    await handleProtectedActionError(error, 'Failed to continue branch.')
  } finally {
    isSubmittingBranch[branch] = false
  }
}

async function declareMerge() {
  if (!requireSignedInAction()) {
    return
  }
  errorMessage.value = ''
  isSubmittingMerge.value = true
  try {
    await $fetch('/api/session/merge', {
      method: 'POST',
      credentials: 'include',
      body: {
        mergedConcept: mergeForm.mergedConcept,
        narrative: mergeForm.narrative || undefined
      }
    })

    mergeForm.mergedConcept = ''
    mergeForm.narrative = ''
    await refreshActiveSession()
  } catch (error) {
    await handleProtectedActionError(error, 'Failed to declare merge.')
  } finally {
    isSubmittingMerge.value = false
  }
}

onMounted(() => {
  void initializeWorkspace()
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fb;
  color: #111827;
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.container {
  margin: 0 auto;
  max-width: 1100px;
  padding: 2rem 1rem 3rem;
}

.header h1 {
  margin: 0;
  font-size: 1.8rem;
}

.header p {
  margin: 0.35rem 0 0;
  color: #4b5563;
}

.welcome-block {
  min-width: 0;
}

.mission-tagline {
  margin: 0.35rem 0 0;
  color: #4b5563;
  line-height: 1.35;
}

.card {
  margin-top: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  background: #fff;
  padding: 1rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.75rem;
  align-items: end;
}

.form-grid label,
.stack {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

input:not([type='checkbox']):not([type='radio']),
textarea,
button,
.archive-link {
  border-radius: 0.5rem;
  border: 1px solid #d1d5db;
  padding: 0.55rem 0.7rem;
  font-size: 0.95rem;
}

.switch-row {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
}

.switch-row input[type='checkbox'] {
  width: 1.1rem;
  height: 1.1rem;
}

.header-top-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.7rem;
}
.header-actions {
  display: inline-flex;
  gap: 0.6rem;
  align-items: center;
  margin-top: 0.1rem;
}

button {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.archive-link {
  text-decoration: none;
  background: #eff6ff;
  border-color: #93c5fd;
  color: #1d4ed8;
}

.signout-button {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.branches-layout {
  margin-top: 0.75rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.branch-column h3 {
  margin: 0 0 0.6rem;
}

.branch-stack {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.branch-card,
.merge-card {
  border: 1px solid #e5e7eb;
  border-radius: 0.6rem;
  padding: 0.75rem;
}

.branch-card {
  display: grid;
  grid-template-rows: auto auto auto minmax(6.5rem, 6.5rem) auto;
}

.topic-value {
  margin-top: 0.25rem;
  font-size: 1.05rem;
  font-weight: 600;
}

.summary-text {
  margin: 0.35rem 0 0;
  overflow-y: auto;
  line-height: 1.35;
  padding-right: 0.2rem;
}

.next-layout {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.suggestions {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}

.suggestions li {
  min-width: 0;
}

.suggestion-button {
  width: 100%;
  background: #1f6a8d;
  color: #f7fafc;
  border-color: #145174;
  border-width: 2px;
  min-height: 3.5rem;
  font-size: 0.95rem;
}

.suggestion-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #145174;
  border-radius: 0.5rem;
  min-height: 3.5rem;
  padding: 0.35rem 0.55rem;
  background: #e8f3f8;
  color: #1f6a8d;
  font-size: 0.95rem;
}

.choice-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.7rem;
}

.choice-row button {
  min-width: 9.5rem;
  min-height: 3.5rem;
}

.muted {
  color: #6b7280;
}

.error {
  margin-top: 1rem;
  color: #b91c1c;
  font-weight: 500;
}

@media (max-width: 900px) {
  .form-grid,
  .branches-layout {
    grid-template-columns: 1fr;
  }

  .suggestions {
    grid-template-columns: 1fr;
  }

  .choice-row {
    grid-template-columns: 1fr;
  }
  .header-top-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .header-actions {
    margin-top: 0;
  }
}
</style>
