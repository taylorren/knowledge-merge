<template>
  <div class="page">
    <main class="container">
      <header class="header">
        <h1>Merge cards archive</h1>
        <p>Browse historical merge outcomes and inspect detailed reasoning.</p>
      </header>

      <section class="card">
        <div class="top-row">
          <NuxtLink class="secondary-link" to="/">← Back to login</NuxtLink>
          <button v-if="pageMode === 'detail'" class="secondary-button" type="button" @click="openList">
            Back to list
          </button>
        </div>

        <div v-if="pageMode === 'list'">
          <ul class="merge-list">
            <li v-for="card in mergeCards" :key="card.id" class="merge-list-item">
              <div class="archive-top-row">
                <h3 class="merged-concept-title">{{ card.mergedConcept }}</h3>
                <button class="view-detail-button" type="button" @click="openDetail(card.id)">View Detail</button>
              </div>
              <p class="muted archive-label">Starting points</p>
              <div class="starting-points-row">
                <span>{{ card.leftTopic || '—' }}</span>
                <span class="points-arrow">↔</span>
                <span>{{ card.rightTopic || '—' }}</span>
              </div>
            </li>
            <li v-if="!mergeCards.length" class="muted">No archived merges yet.</li>
          </ul>
        </div>

        <div v-else-if="selectedCard" class="detail-page">
          <h2>{{ selectedCard.mergedConcept }}</h2>
          <p class="muted">Archived: {{ formatArchivedDate(selectedCard.createdAt) }}</p>
          <p class="muted">Starting points: {{ selectedCard.leftTopic }} ↔ {{ selectedCard.rightTopic }}</p>
          <div class="paths-grid">
            <div class="detail-block">
              <p class="muted">Left path</p>
              <div class="path-concepts">
                <template v-if="selectedCard.leftPath.length">
                  <template v-for="(concept, index) in selectedCard.leftPath" :key="`left-${concept}-${index}`">
                    <button
                      class="path-concept-chip"
                      type="button"
                      @mouseenter="showConceptPreview('left', index + 1, concept)"
                      @mouseleave="hideConceptPreview"
                      @focus="showConceptPreview('left', index + 1, concept)"
                      @blur="hideConceptPreview"
                    >
                      {{ concept }}
                    </button>
                    <span v-if="index < selectedCard.leftPath.length - 1" class="path-separator">→</span>
                  </template>
                </template>
                <span v-else class="muted">—</span>
              </div>
            </div>

            <div class="detail-block">
              <p class="muted">Right path</p>
              <div class="path-concepts">
                <template v-if="selectedCard.rightPath.length">
                  <template v-for="(concept, index) in selectedCard.rightPath" :key="`right-${concept}-${index}`">
                    <button
                      class="path-concept-chip"
                      type="button"
                      @mouseenter="showConceptPreview('right', index + 1, concept)"
                      @mouseleave="hideConceptPreview"
                      @focus="showConceptPreview('right', index + 1, concept)"
                      @blur="hideConceptPreview"
                    >
                      {{ concept }}
                    </button>
                    <span v-if="index < selectedCard.rightPath.length - 1" class="path-separator">→</span>
                  </template>
                </template>
                <span v-else class="muted">—</span>
              </div>
            </div>
          </div>

          <div class="detail-block">
            <p class="muted">Reason</p>
            <p>{{ selectedCard.narrative }}</p>
          </div>
        </div>

        <p v-else class="muted">
          Selected merge card is no longer available.
        </p>
      </section>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

      <div v-if="activeConceptPreview" class="concept-hover-modal">
        <div class="concept-hover-content">
          <p class="concept-hover-title">{{ activeConceptPreview.concept }}</p>
          <p v-if="activeConceptPreview.loading" class="concept-hover-muted">Loading summary…</p>
          <p v-else-if="activeConceptPreview.error" class="concept-hover-error">{{ activeConceptPreview.error }}</p>
          <p v-else class="concept-hover-summary">{{ activeConceptPreview.summary }}</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
interface MergeCard {
  id: number
  mergedConcept: string
  narrative: string
  leftPath: string[]
  rightPath: string[]
  createdAt: string
  leftTopic?: string
  rightTopic?: string
}
type BranchSide = 'left' | 'right'

interface ConceptPreviewPayload {
  concept: string
  summary: string
}

interface ConceptPreviewResponse {
  concept: ConceptPreviewPayload
}

interface ActiveConceptPreview {
  key: string
  concept: string
  summary: string | null
  loading: boolean
  error: string | null
}

const mergeCards = ref<MergeCard[]>([])
const errorMessage = ref('')
const pageMode = ref<'list' | 'detail'>('list')
const selectedCardId = ref<number | null>(null)
const activeConceptPreview = ref<ActiveConceptPreview | null>(null)
const conceptPreviewCache = ref<Record<string, ConceptPreviewPayload>>({})

const selectedCard = computed(() => {
  if (selectedCardId.value === null) {
    return null
  }

  return mergeCards.value.find(card => card.id === selectedCardId.value) ?? null
})

function formatArchivedDate(value: string): string {
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(date)
}

function openDetail(cardId: number) {
  selectedCardId.value = cardId
  activeConceptPreview.value = null
  pageMode.value = 'detail'
}

function openList() {
  selectedCardId.value = null
  activeConceptPreview.value = null
  pageMode.value = 'list'
}

function makeConceptPreviewKey(mergeCardId: number, branch: BranchSide, stepIndex: number): string {
  return `${mergeCardId}:${branch}:${stepIndex}`
}

async function showConceptPreview(branch: BranchSide, stepIndex: number, concept: string) {
  if (!selectedCard.value) {
    return
  }

  const mergeCardId = selectedCard.value.id
  const key = makeConceptPreviewKey(mergeCardId, branch, stepIndex)
  const cached = conceptPreviewCache.value[key]

  if (cached) {
    activeConceptPreview.value = {
      key,
      concept: cached.concept,
      summary: cached.summary,
      loading: false,
      error: null
    }
    return
  }

  activeConceptPreview.value = {
    key,
    concept,
    summary: null,
    loading: true,
    error: null
  }

  try {
    const response = await $fetch<ConceptPreviewResponse>(`/api/merge-cards/${mergeCardId}/concept`, {
      query: {
        branch,
        stepIndex
      }
    })

    conceptPreviewCache.value[key] = response.concept

    if (activeConceptPreview.value?.key === key) {
      activeConceptPreview.value = {
        key,
        concept: response.concept.concept,
        summary: response.concept.summary,
        loading: false,
        error: null
      }
    }
  } catch {
    if (activeConceptPreview.value?.key === key) {
      activeConceptPreview.value = {
        key,
        concept,
        summary: null,
        loading: false,
        error: 'Failed to load summary.'
      }
    }
  }
}

function hideConceptPreview() {
  activeConceptPreview.value = null
}

async function refreshMergeCards() {
  const response = await $fetch<{ mergeCards: MergeCard[] }>('/api/merge-cards/recent?limit=50')
  mergeCards.value = response.mergeCards
}

async function loadData() {
  errorMessage.value = ''
  try {
    await refreshMergeCards()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load merge archives.'
  }
}

onMounted(loadData)
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
  max-width: 900px;
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

.card {
  margin-top: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  background: #fff;
  padding: 1rem;
}

.top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
}

.archive-label {
  margin-top: 0.8rem;
}

.starting-points-row {
  margin-top: 0.35rem;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.65rem;
  max-width: 22rem;
  font-size: 1.05rem;
  font-weight: 600;
}

.points-arrow {
  color: #1f6a8d;
}

button,
.secondary-link {
  border-radius: 0.5rem;
  border: 1px solid #d1d5db;
  padding: 0.55rem 0.7rem;
  font-size: 0.95rem;
}

button {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
}

.secondary-button,
.secondary-link {
  background: #f3f4f6;
  border-color: #d1d5db;
  color: #374151;
  text-decoration: none;
}

.merge-list {
  margin: 0.8rem 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.merge-list-item {
  border: 1px solid #eef2f7;
  border-radius: 0.55rem;
  padding: 0.75rem;
  background: #fafcff;
}

.merge-list-item p {
  margin: 0.35rem 0 0;
}

.archive-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
}

.merged-concept-title {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.2;
  font-weight: 700;
  color: #0f172a;
}

.view-detail-button {
  background: #1f6a8d;
  border-color: #145174;
  border-width: 2px;
  min-height: 3.2rem;
  min-width: 14rem;
  font-size: 0.95rem;
}

.detail-page {
  margin-top: 0.8rem;
  border: 1px solid #eef2f7;
  border-radius: 0.55rem;
  padding: 0.8rem;
  background: #fafcff;
}

.detail-page h2 {
  margin: 0;
}
.paths-grid {
  margin-top: 0.7rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
}

.detail-block {
  margin-top: 0.7rem;
}

.detail-block p {
  margin: 0.25rem 0 0;
}

.path-concepts {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.path-concept-chip {
  background: #eef4ff;
  color: #1f2937;
  border-color: #bfdbfe;
  border-width: 1px;
  padding: 0.3rem 0.55rem;
  border-radius: 0.45rem;
  min-height: auto;
  cursor: zoom-in;
}

.path-separator {
  color: #64748b;
  font-size: 0.95rem;
}

.concept-hover-modal {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  pointer-events: none;
  z-index: 20;
}

.concept-hover-content {
  min-width: 14rem;
  max-width: min(80vw, 32rem);
  border-radius: 0.75rem;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #111827;
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  text-align: left;
}

.concept-hover-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.concept-hover-summary {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.45;
  color: #1f2937;
}

.concept-hover-muted {
  margin: 0;
  font-size: 0.86rem;
  color: #6b7280;
}

.concept-hover-error {
  margin: 0;
  font-size: 0.86rem;
  color: #b91c1c;
}

.muted {
  color: #6b7280;
}

.error {
  margin-top: 1rem;
  color: #b91c1c;
  font-weight: 500;
}

@media (max-width: 800px) {
  .paths-grid {
    grid-template-columns: 1fr;
  }
}
</style>
