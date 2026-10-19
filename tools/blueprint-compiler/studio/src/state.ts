// UI state shapes and helpers shared by App and the components.
import type { BlueprintInput, Provider, Runtime, StreamEvent } from './api'

export type SourceKind = BlueprintInput['kind']

export type FormState = {
  id?: string // set once the blueprint has been saved
  name: string
  sourceKind: SourceKind
  markdown: string
  url: string
  registryRef: string
  prompt: string
  provider: Provider
  runtime: Runtime
}

export const EMPTY_FORM: FormState = {
  name: '',
  sourceKind: 'text',
  markdown: '',
  url: '',
  registryRef: '',
  prompt: '',
  provider: 'mock',
  runtime: 'direct',
}

export function toInput(form: FormState): BlueprintInput {
  if (form.sourceKind === 'url') return { kind: 'url', url: form.url.trim() }
  if (form.sourceKind === 'registry') return { kind: 'registry', ref: form.registryRef.trim() }
  return { kind: 'text', markdown: form.markdown }
}

export type RunState = {
  status: 'idle' | 'running' | 'done' | 'error' | 'stopped'
  text: string
  start?: Extract<StreamEvent, { type: 'start' }>
  done?: Extract<StreamEvent, { type: 'done' }>
  failure?: Extract<StreamEvent, { type: 'error' }>
  message?: string
}

export const IDLE_RUN: RunState = { status: 'idle', text: '' }
