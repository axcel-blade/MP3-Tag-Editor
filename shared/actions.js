import { copyTags, findReplaceTags } from './tag-transforms.js'
import { compileFilenamePattern, filenameTagChanges } from './filename-tags.js'

/** Tag tools that can be saved as action steps, and the options each one keeps. */
export const ACTION_STEP_OPTIONS = {
  replace: { fields: 'array', find: 'string', replace: 'string', useRegex: 'boolean', caseSensitive: 'boolean' },
  copy: { target: 'string', format: 'string', clearSource: 'boolean' },
  filename: { filenamePattern: 'string' },
}

const MAX_ACTIONS = 100
const MAX_STEPS = 50
const MAX_NAME_LENGTH = 60

/** Keep only the options a step mode uses (e.g. from the tool popup's shared options object). */
export function pickStepOptions(mode, options) {
  const schema = ACTION_STEP_OPTIONS[mode]
  if (!schema) throw new Error(`This tool can't be saved as an action step: ${mode}`)
  const picked = {}
  for (const [key, type] of Object.entries(schema)) {
    const value = options?.[key]
    if (type === 'array') picked[key] = Array.isArray(value) ? value.map(String) : []
    else if (type === 'boolean') picked[key] = Boolean(value)
    else picked[key] = String(value ?? '')
  }
  return picked
}

/** Validate saved actions loaded from disk; drops anything malformed. */
export function sanitizeActions(raw) {
  if (!Array.isArray(raw)) return []
  const actions = []
  for (const action of raw.slice(0, MAX_ACTIONS)) {
    const name = String(action?.name ?? '').trim().slice(0, MAX_NAME_LENGTH)
    if (!name || actions.some((a) => a.name === name)) continue
    const steps = (Array.isArray(action.steps) ? action.steps : [])
      .slice(0, MAX_STEPS)
      .filter((step) => ACTION_STEP_OPTIONS[step?.mode])
      .map((step) => ({ mode: step.mode, options: pickStepOptions(step.mode, step.options) }))
    if (steps.length > 0) actions.push({ name, steps })
  }
  return actions
}

/** Append a step to the named action, creating the action if needed. Returns a new list. */
export function addActionStep(actions, name, mode, options) {
  const trimmed = String(name ?? '').trim().slice(0, MAX_NAME_LENGTH)
  if (!trimmed) throw new Error('Enter an action name')
  const step = { mode, options: pickStepOptions(mode, options) }
  const existing = actions.find((a) => a.name === trimmed)
  if (existing && existing.steps.length >= MAX_STEPS) throw new Error(`An action can have at most ${MAX_STEPS} steps`)
  if (!existing && actions.length >= MAX_ACTIONS) throw new Error(`You can save at most ${MAX_ACTIONS} actions`)
  return existing
    ? actions.map((a) => (a === existing ? { ...a, steps: [...a.steps, step] } : a))
    : [...actions, { name: trimmed, steps: [step] }]
}

/** One-line summary of a step for lists and tooltips. */
export function describeStep({ mode, options }) {
  switch (mode) {
    case 'replace':
      return `Replace "${options.find}" → "${options.replace}"${options.useRegex ? ' (regex)' : ''}`
    case 'copy':
      return `${options.clearSource ? 'Move' : 'Copy'} ${options.format} → ${options.target}`
    case 'filename':
      return `Tags from filename: ${options.filenamePattern}`
    default:
      return mode
  }
}

/**
 * Run an action's steps on one file. Each step sees the previous steps' results.
 * Returns only fields whose final value differs from the original tags.
 */
export function runAction(action, filePath, tags, fieldKeys) {
  const working = { ...tags }
  for (const step of action.steps) {
    let changes
    if (step.mode === 'replace') changes = findReplaceTags(working, step.options)
    else if (step.mode === 'copy') changes = copyTags(working, step.options)
    else if (step.mode === 'filename') {
      changes = filenameTagChanges(compileFilenamePattern(step.options.filenamePattern, fieldKeys), filePath, working)
    } else throw new Error(`Unknown action step: ${step.mode}`)
    Object.assign(working, changes)
  }

  const result = {}
  for (const key of fieldKeys) {
    if (String(working[key] ?? '') !== String(tags?.[key] ?? '')) result[key] = working[key]
  }
  return result
}
