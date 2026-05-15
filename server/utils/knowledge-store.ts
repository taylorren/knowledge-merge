import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { DatabaseSync as NodeDatabaseSync } from 'node:sqlite'

type SessionStatus = 'active' | 'merged' | 'abandoned'
export type BranchSide = 'left' | 'right'
export type AiProvider = 'local' | 'cloud'

export const LOCAL_OLLAMA_BASE_URI = process.env.LOCAL_OLLAMA_BASE_URI?.trim() ?? ''
export const LOCAL_OLLAMA_MODEL = process.env.LOCAL_OLLAMA_MODEL?.trim() ?? ''
export const CLOUD_AI_BASE_URI = process.env.CLOUD_AI_BASE_URI?.trim() ?? ''
export const CLOUD_AI_MODEL = process.env.CLOUD_AI_MODEL?.trim() ?? ''
export const CLOUD_AI_API_KEY = process.env.CLOUD_AI_API_KEY?.trim() ?? ''

export interface BranchStep {
  id: number
  sessionId: number
  branch: BranchSide
  stepIndex: number
  keyword: string
  summary: string
  suggestions: string[]
  createdAt: string
}

export interface KnowledgeSession {
  id: number
  leftTopic: string
  rightTopic: string
  status: SessionStatus
  mergeConcept: string | null
  createdAt: string
  updatedAt: string
}

export interface KnowledgeSessionWithSteps {
  session: KnowledgeSession
  leftSteps: BranchStep[]
  rightSteps: BranchStep[]
}

export interface MergeCard {
  id: number
  sessionId: number
  mergedConcept: string
  narrative: string
  leftPath: string[]
  rightPath: string[]
  createdAt: string
  leftTopic?: string
  rightTopic?: string
}

export interface MergeCardConceptDetail {
  keyword: string
  summary: string
  stepIndex: number
}

export interface MergeCardDetail extends MergeCard {
  leftConcepts: MergeCardConceptDetail[]
  rightConcepts: MergeCardConceptDetail[]
}

export interface MergeCardConceptPreview {
  keyword: string
  summary: string
  branch: BranchSide
  stepIndex: number
}

export interface AiSettings {
  activeProvider: AiProvider
  localBaseUri: string
  localModel: string
  cloudBaseUri: string
  cloudModel: string
  hasCloudApiKey: boolean
  updatedAt: string
}

export interface AiSettingsWithSecret extends AiSettings {
  cloudApiKey: string
}

interface SessionRow {
  id: number
  left_topic: string
  right_topic: string
  status: SessionStatus
  merge_concept: string | null
  created_at: string
  updated_at: string
}

interface StepRow {
  id: number
  session_id: number
  branch: BranchSide
  step_index: number
  keyword: string
  summary: string
  suggestions_json: string
  created_at: string
}

interface MergeRow {
  id: number
  session_id: number
  merged_concept: string
  narrative: string
  left_path_json: string
  right_path_json: string
  created_at: string
  left_topic?: string
  right_topic?: string
}

interface AiSettingsRow {
  active_provider: AiProvider
  updated_at: string
}

declare global {
  // eslint-disable-next-line no-var
  var __knowledgeMergesDb: NodeDatabaseSync | undefined
}

const DB_PATH = process.env.KNOWLEDGE_MERGES_DB_PATH
  ? resolve(process.env.KNOWLEDGE_MERGES_DB_PATH)
  : resolve(process.cwd(), 'data', 'knowledge-merges.db')

function loadDatabaseSync(): typeof NodeDatabaseSync {
  const getBuiltinModule = (
    process as unknown as { getBuiltinModule?: (id: string) => Record<string, unknown> | undefined }
  ).getBuiltinModule

  const sqliteModule = getBuiltinModule?.('node:sqlite')
  const DatabaseSync = sqliteModule?.DatabaseSync as typeof NodeDatabaseSync | undefined

  if (!DatabaseSync) {
    throw new Error(
      'node:sqlite is unavailable in this runtime. Please use Node.js 22.5+ (preferably 24+) for SQLite support.'
    )
  }

  return DatabaseSync
}

function getDb(): NodeDatabaseSync {
  if (!globalThis.__knowledgeMergesDb) {
    mkdirSync(dirname(DB_PATH), { recursive: true })
    const DatabaseSync = loadDatabaseSync()
    const db = new DatabaseSync(DB_PATH)
    db.exec('PRAGMA foreign_keys = ON;')
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        left_topic TEXT NOT NULL,
        right_topic TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('active', 'merged', 'abandoned')),
        merge_concept TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_session
        ON sessions(status)
        WHERE status = 'active';

      CREATE TABLE IF NOT EXISTS branch_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        branch TEXT NOT NULL CHECK(branch IN ('left', 'right')),
        step_index INTEGER NOT NULL,
        keyword TEXT NOT NULL,
        summary TEXT NOT NULL,
        suggestions_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(session_id, branch, step_index)
      );

      CREATE INDEX IF NOT EXISTS idx_branch_steps_session_id
        ON branch_steps(session_id);

      CREATE TABLE IF NOT EXISTS merge_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
        merged_concept TEXT NOT NULL,
        narrative TEXT NOT NULL,
        left_path_json TEXT NOT NULL,
        right_path_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_merge_cards_created_at
        ON merge_cards(created_at DESC);

      CREATE TABLE IF NOT EXISTS ai_settings (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        active_provider TEXT NOT NULL CHECK(active_provider IN ('local', 'cloud')),
        cloud_base_uri TEXT NOT NULL DEFAULT '',
        cloud_api_key TEXT NOT NULL DEFAULT '',
        cloud_model TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO ai_settings (id, active_provider, cloud_base_uri, cloud_api_key, cloud_model)
      VALUES (1, 'local', '', '', '')
      ON CONFLICT(id) DO NOTHING;
    `)

    globalThis.__knowledgeMergesDb = db
  }

  return globalThis.__knowledgeMergesDb
}

function mapSession(row: SessionRow): KnowledgeSession {
  return {
    id: row.id,
    leftTopic: row.left_topic,
    rightTopic: row.right_topic,
    status: row.status,
    mergeConcept: row.merge_concept,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapStep(row: StepRow): BranchStep {
  return {
    id: row.id,
    sessionId: row.session_id,
    branch: row.branch,
    stepIndex: row.step_index,
    keyword: row.keyword,
    summary: row.summary,
    suggestions: JSON.parse(row.suggestions_json),
    createdAt: row.created_at
  }
}

function mapMergeCard(row: MergeRow): MergeCard {
  return {
    id: row.id,
    sessionId: row.session_id,
    mergedConcept: row.merged_concept,
    narrative: row.narrative,
    leftPath: JSON.parse(row.left_path_json),
    rightPath: JSON.parse(row.right_path_json),
    createdAt: row.created_at,
    leftTopic: row.left_topic,
    rightTopic: row.right_topic
  }
}

function getActiveSessionRow(): SessionRow | null {
  const db = getDb()
  const row = db
    .prepare(
      `
      SELECT id, left_topic, right_topic, status, merge_concept, created_at, updated_at
      FROM sessions
      WHERE status = 'active'
      LIMIT 1
      `
    )
    .get() as SessionRow | undefined

  return row ?? null
}

function getStepsForSession(sessionId: number): BranchStep[] {
  const db = getDb()
  const rows = db
    .prepare(
      `
      SELECT id, session_id, branch, step_index, keyword, summary, suggestions_json, created_at
      FROM branch_steps
      WHERE session_id = ?
      ORDER BY branch ASC, step_index ASC
      `
    )
    .all(sessionId) as StepRow[]

  return rows.map(mapStep)
}

export function getActiveSessionWithSteps(): KnowledgeSessionWithSteps | null {
  const sessionRow = getActiveSessionRow()

  if (!sessionRow) {
    return null
  }

  const allSteps = getStepsForSession(sessionRow.id)
  return {
    session: mapSession(sessionRow),
    leftSteps: allSteps.filter(step => step.branch === 'left'),
    rightSteps: allSteps.filter(step => step.branch === 'right')
  }
}

export function startNewSession(leftTopic: string, rightTopic: string): KnowledgeSessionWithSteps {
  const db = getDb()
  const normalizedLeft = leftTopic.trim()
  const normalizedRight = rightTopic.trim()

  if (!normalizedLeft || !normalizedRight) {
    throw new Error('Both left and right topics are required.')
  }

  db.exec('BEGIN')
  try {
    db.prepare(
      `
      UPDATE sessions
      SET status = 'abandoned', updated_at = datetime('now')
      WHERE status = 'active'
      `
    ).run()

    const result = db
      .prepare(
        `
        INSERT INTO sessions (left_topic, right_topic, status)
        VALUES (?, ?, 'active')
        `
      )
      .run(normalizedLeft, normalizedRight)

    const sessionId = Number(result.lastInsertRowid)
    db.exec('COMMIT')

    const sessionRow = db
      .prepare(
        `
        SELECT id, left_topic, right_topic, status, merge_concept, created_at, updated_at
        FROM sessions
        WHERE id = ?
        LIMIT 1
        `
      )
      .get(sessionId) as SessionRow | undefined

    if (!sessionRow) {
      throw new Error('Failed to load created session.')
    }

    return {
      session: mapSession(sessionRow),
      leftSteps: [],
      rightSteps: []
    }
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function addStepToActiveSession(input: {
  branch: BranchSide
  keyword: string
  summary?: string
  suggestions?: string[]
}): KnowledgeSessionWithSteps {
  const db = getDb()
  const activeSession = getActiveSessionRow()

  if (!activeSession) {
    throw new Error('No active session found. Start a new session first.')
  }

  const keyword = input.keyword.trim()
  if (!keyword) {
    throw new Error('Keyword is required.')
  }

  const summary = input.summary?.trim() || `Summary pending generation for "${keyword}".`
  const suggestions = (input.suggestions ?? [])
    .map(suggestion => suggestion.trim())
    .filter(Boolean)
    .slice(0, 3)

  const nextIndexRow = db
    .prepare(
      `
      SELECT COALESCE(MAX(step_index), 0) + 1 AS next_index
      FROM branch_steps
      WHERE session_id = ? AND branch = ?
      `
    )
    .get(activeSession.id, input.branch) as { next_index: number }

  db.exec('BEGIN')
  try {
    db.prepare(
      `
      INSERT INTO branch_steps (session_id, branch, step_index, keyword, summary, suggestions_json)
      VALUES (?, ?, ?, ?, ?, ?)
      `
    ).run(
      activeSession.id,
      input.branch,
      nextIndexRow.next_index,
      keyword,
      summary,
      JSON.stringify(suggestions)
    )

    db.prepare(
      `
      UPDATE sessions
      SET updated_at = datetime('now')
      WHERE id = ?
      `
    ).run(activeSession.id)

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  const session = getActiveSessionWithSteps()
  if (!session) {
    throw new Error('Failed to load active session after adding step.')
  }

  return session
}

export function declareMergeForActiveSession(input: {
  mergedConcept: string
  narrative: string
}): MergeCard {
  const db = getDb()
  const activeSession = getActiveSessionRow()

  if (!activeSession) {
    throw new Error('No active session found. Start a new session first.')
  }

  const mergedConcept = input.mergedConcept.trim()
  const narrative = input.narrative.trim()
  if (!mergedConcept || !narrative) {
    throw new Error('Both merged concept and narrative are required.')
  }

  const stepRows = db
    .prepare(
      `
      SELECT id, session_id, branch, step_index, keyword, summary, suggestions_json, created_at
      FROM branch_steps
      WHERE session_id = ?
      ORDER BY step_index ASC
      `
    )
    .all(activeSession.id) as StepRow[]

  const leftPath = stepRows.filter(step => step.branch === 'left').map(step => step.keyword)
  const rightPath = stepRows.filter(step => step.branch === 'right').map(step => step.keyword)

  db.exec('BEGIN')
  try {
    const result = db
      .prepare(
        `
        INSERT INTO merge_cards (session_id, merged_concept, narrative, left_path_json, right_path_json)
        VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(activeSession.id, mergedConcept, narrative, JSON.stringify(leftPath), JSON.stringify(rightPath))

    db.prepare(
      `
      UPDATE sessions
      SET status = 'merged', merge_concept = ?, updated_at = datetime('now')
      WHERE id = ?
      `
    ).run(mergedConcept, activeSession.id)

    db.exec('COMMIT')

    const cardId = Number(result.lastInsertRowid)
    const row = db
      .prepare(
        `
        SELECT id, session_id, merged_concept, narrative, left_path_json, right_path_json, created_at
        FROM merge_cards
        WHERE id = ?
        LIMIT 1
        `
      )
      .get(cardId) as MergeRow | undefined

    if (!row) {
      throw new Error('Failed to load merge card.')
    }

    return mapMergeCard(row)
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}


function mapAiSettings(row: AiSettingsRow): AiSettings {
  return {
    activeProvider: row.active_provider,
    localBaseUri: LOCAL_OLLAMA_BASE_URI,
    localModel: LOCAL_OLLAMA_MODEL,
    cloudBaseUri: CLOUD_AI_BASE_URI,
    cloudModel: CLOUD_AI_MODEL,
    hasCloudApiKey: Boolean(CLOUD_AI_API_KEY),
    updatedAt: row.updated_at
  }
}

function mapAiSettingsWithSecret(row: AiSettingsRow): AiSettingsWithSecret {
  const settings = mapAiSettings(row)
  return {
    ...settings,
    cloudApiKey: CLOUD_AI_API_KEY
  }
}
export function listRecentMergeCards(limit = 10): MergeCard[] {
  const db = getDb()
  const cappedLimit = Math.max(1, Math.min(50, Number.isFinite(limit) ? Math.floor(limit) : 10))

  const rows = db
    .prepare(
      `
      SELECT
        m.id,
        m.session_id,
        m.merged_concept,
        m.narrative,
        m.left_path_json,
        m.right_path_json,
        m.created_at,
        s.left_topic,
        s.right_topic
      FROM merge_cards m
      JOIN sessions s ON s.id = m.session_id
      ORDER BY m.created_at DESC
      LIMIT ?
      `
    )
    .all(cappedLimit) as MergeRow[]

  return rows.map(mapMergeCard)
}

export function getMergeCardConceptPreview(input: {
  mergeCardId: number
  branch: BranchSide
  stepIndex: number
}): MergeCardConceptPreview | null {
  const db = getDb()
  const row = db
    .prepare(
      `
      SELECT bs.keyword, bs.summary, bs.branch, bs.step_index
      FROM merge_cards m
      JOIN branch_steps bs ON bs.session_id = m.session_id
      WHERE m.id = ? AND bs.branch = ? AND bs.step_index = ?
      LIMIT 1
      `
    )
    .get(input.mergeCardId, input.branch, input.stepIndex) as
    | { keyword: string; summary: string; branch: BranchSide; step_index: number }
    | undefined

  if (!row) {
    return null
  }

  return {
    keyword: row.keyword,
    summary: row.summary,
    branch: row.branch,
    stepIndex: row.step_index
  }
}

export function getMergeCardDetailById(mergeCardId: number): MergeCardDetail | null {
  const db = getDb()
  const row = db
    .prepare(
      `
      SELECT
        m.id,
        m.session_id,
        m.merged_concept,
        m.narrative,
        m.left_path_json,
        m.right_path_json,
        m.created_at,
        s.left_topic,
        s.right_topic
      FROM merge_cards m
      JOIN sessions s ON s.id = m.session_id
      WHERE m.id = ?
      LIMIT 1
      `
    )
    .get(mergeCardId) as MergeRow | undefined

  if (!row) {
    return null
  }

  const baseCard = mapMergeCard(row)
  const sessionSteps = getStepsForSession(baseCard.sessionId)
  const leftConcepts = sessionSteps
    .filter(step => step.branch === 'left')
    .map(step => ({
      keyword: step.keyword,
      summary: step.summary,
      stepIndex: step.stepIndex
    }))
  const rightConcepts = sessionSteps
    .filter(step => step.branch === 'right')
    .map(step => ({
      keyword: step.keyword,
      summary: step.summary,
      stepIndex: step.stepIndex
    }))

  return {
    ...baseCard,
    leftConcepts,
    rightConcepts
  }
}

export function getAiSettings(): AiSettings {
  const db = getDb()
  const row = db
    .prepare(
      `
      SELECT active_provider, updated_at
      FROM ai_settings
      WHERE id = 1
      LIMIT 1
      `
    )
    .get() as AiSettingsRow | undefined

  if (!row) {
    throw new Error('AI settings are missing.')
  }

  return mapAiSettings(row)
}

export function getAiSettingsWithSecret(): AiSettingsWithSecret {
  const db = getDb()
  const row = db
    .prepare(
      `
      SELECT active_provider, updated_at
      FROM ai_settings
      WHERE id = 1
      LIMIT 1
      `
    )
    .get() as AiSettingsRow | undefined

  if (!row) {
    throw new Error('AI settings are missing.')
  }

  return mapAiSettingsWithSecret(row)
}

export function updateAiSettings(input: {
  activeProvider?: AiProvider
}): AiSettings {
  const db = getDb()
  const current = getAiSettingsWithSecret()
  const nextActiveProvider = input.activeProvider ?? current.activeProvider

  if (nextActiveProvider === 'cloud') {
    if (!CLOUD_AI_BASE_URI || !CLOUD_AI_MODEL || !CLOUD_AI_API_KEY) {
      throw new Error(
        'Cloud provider requires CLOUD_AI_BASE_URI, CLOUD_AI_MODEL, and CLOUD_AI_API_KEY in .env.'
      )
    }
  } else if (!LOCAL_OLLAMA_BASE_URI || !LOCAL_OLLAMA_MODEL) {
    throw new Error('Local provider requires LOCAL_OLLAMA_BASE_URI and LOCAL_OLLAMA_MODEL in .env.')
  }

  db.prepare(
    `
    UPDATE ai_settings
    SET
      active_provider = ?,
      updated_at = datetime('now')
    WHERE id = 1
    `
  ).run(nextActiveProvider)

  return getAiSettings()
}
