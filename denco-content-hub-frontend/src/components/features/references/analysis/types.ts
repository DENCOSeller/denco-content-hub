// ─── Analysis data types ─────────────────────────────────────────────────────
// These types match the backend Pydantic schemas exactly.

export interface AnalysisSummary {
  text: string
}

export interface AnalysisThesis {
  title: string
  description: string
}

export interface AnalysisHook {
  hook: string
  explanation: string
}

export interface StoryboardBlock {
  topic: string
  purpose: string
  time_start: string | null
  time_end: string | null
  block_number: number | null
}

export interface AnalysisContentIdea {
  title: string
  description: string
}

export type AnalysisStatus = 'loading' | 'empty' | 'ready'
