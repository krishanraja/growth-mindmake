#!/usr/bin/env node

import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import { extname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const COMPLETION_SOURCES = new Set([
  'authoritative_output',
  'destination_readback',
  'rendered_artifact',
  'independent_rederivation',
])
const RETRY_MODES = new Set(['idempotent', 'at_most_once', 'manual'])
const DEFAULT_SCHEMA = JSON.parse(readFileSync(fileURLToPath(new URL('../references/stage-conveyor-manifest.schema.json', import.meta.url)), 'utf8'))

function normalized(value) {
  return String(value).replaceAll('\\', '/').replace(/^\.\//u, '')
}

function globRegex(glob) {
  const source = normalized(glob)
  let result = '^'
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (char === '*' && source[index + 1] === '*') {
      index += 1
      if (source[index + 1] === '/') {
        index += 1
        result += '(?:.*/)?'
      } else {
        result += '.*'
      }
    } else if (char === '*') {
      result += '[^/]*'
    } else if (char === '?') {
      result += '[^/]'
    } else {
      result += char.replace(/[|\\{}()[\]^$+?.]/gu, '\\$&')
    }
  }
  return new RegExp(`${result}$`, 'u')
}

function matches(path, patterns = []) {
  return patterns.some(pattern => globRegex(pattern).test(normalized(path)))
}

function stringArray(value, nonEmpty = false) {
  return Array.isArray(value) && (!nonEmpty || value.length > 0) && value.every(item => typeof item === 'string' && item.length > 0)
}

function unique(values) {
  return new Set(values).size === values.length
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function resolveRef(rootSchema, ref) {
  if (!ref.startsWith('#/')) throw new Error(`unsupported schema reference: ${ref}`)
  return ref.slice(2).split('/').reduce((value, key) => value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], rootSchema)
}

function validateJsonSchema(value, schema, rootSchema, path, errors) {
  if (schema.$ref) return validateJsonSchema(value, resolveRef(rootSchema, schema.$ref), rootSchema, path, errors)
  if (schema.allOf) for (const part of schema.allOf) validateJsonSchema(value, part, rootSchema, path, errors)
  if (schema.if && schema.then) {
    const conditionalErrors = []
    validateJsonSchema(value, schema.if, rootSchema, path, conditionalErrors)
    if (conditionalErrors.length === 0) validateJsonSchema(value, schema.then, rootSchema, path, errors)
  }

  if (schema.const !== undefined && !same(value, schema.const)) errors.push(`${path} must equal ${JSON.stringify(schema.const)}`)
  if (schema.enum && !schema.enum.some(item => same(item, value))) errors.push(`${path} must be one of ${schema.enum.join(', ')}`)
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { errors.push(`${path} must be an object`); return }
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${path} is missing property: ${key}`)
    if (schema.additionalProperties === false) for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties ?? {}, key)) errors.push(`${path} has unknown property: ${key}`)
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) if (Object.hasOwn(value, key)) validateJsonSchema(value[key], childSchema, rootSchema, `${path}.${key}`, errors)
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) { errors.push(`${path} must be an array`); return }
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path} requires at least ${schema.minItems} item(s)`)
    if (schema.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) errors.push(`${path} items must be unique`)
    for (let index = 0; index < value.length; index += 1) if (schema.items) validateJsonSchema(value[index], schema.items, rootSchema, `${path}[${index}]`, errors)
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') { errors.push(`${path} must be a string`); return }
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path} is too short`)
  }
  if (schema.type === 'integer') {
    if (!Number.isInteger(value)) { errors.push(`${path} must be an integer`); return }
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} must be at least ${schema.minimum}`)
  }
}

function safePath(root, candidate) {
  const absolute = resolve(root, candidate)
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`
  if (absolute !== root && !absolute.startsWith(prefix)) throw new Error(`path escapes repository root: ${candidate}`)
  return absolute
}

function inventoryFiles(root, inventory, errors) {
  const files = []
  const extensions = new Set(inventory.extensions ?? [])
  const excludes = inventory.exclude ?? []
  for (const declaredRoot of inventory.roots ?? []) {
    let absolute
    try { absolute = safePath(root, declaredRoot) } catch (error) { errors.push(error.message); continue }
    if (!existsSync(absolute)) { errors.push(`inventory root does not exist: ${declaredRoot}`); continue }
    const rootStat = lstatSync(absolute)
    if (rootStat.isSymbolicLink()) { errors.push(`inventory root cannot be a symbolic link: ${declaredRoot}`); continue }
    if (!rootStat.isDirectory()) { errors.push(`inventory root is not a directory: ${declaredRoot}`); continue }
    const visit = directory => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue
        const path = resolve(directory, entry.name)
        const repoPath = normalized(relative(root, path))
        if (matches(repoPath, excludes)) continue
        if (entry.isDirectory()) visit(path)
        else if (entry.isFile() && (extensions.size === 0 || extensions.has(extname(entry.name)))) files.push(repoPath)
      }
    }
    visit(absolute)
  }
  return [...new Set(files)].sort()
}

function existingRepoFile(root, path, label, errors) {
  try {
    const absolute = safePath(root, path)
    if (!existsSync(absolute)) errors.push(`${label} does not exist: ${path}`)
    else {
      const stat = lstatSync(absolute)
      if (stat.isSymbolicLink() || !stat.isFile()) errors.push(`${label} must be a regular in-repository file: ${path}`)
    }
  } catch (error) {
    errors.push(error.message)
  }
}

export function validateStageConveyor(manifest, rootDirectory, schema = DEFAULT_SCHEMA) {
  const root = resolve(rootDirectory)
  const errors = []
  validateJsonSchema(manifest, schema, schema, 'manifest', errors)
  if (errors.length) return [...new Set(errors)].sort()
  if (manifest.schema_version !== 1) errors.push('schema_version must equal 1')
  if (typeof manifest.pipeline_id !== 'string' || !manifest.pipeline_id) errors.push('pipeline_id is required')

  const inventory = manifest.inventory
  if (!inventory || !stringArray(inventory.roots, true) || !stringArray(inventory.extensions, true) || !stringArray(inventory.exclude ?? [])) {
    errors.push('inventory requires string arrays: roots, extensions, and optional exclude')
  }

  const stages = manifest.stages
  const guards = manifest.guards
  const edges = manifest.edges
  const entrypoints = manifest.entrypoints
  const learnings = manifest.learnings
  const externalInputs = manifest.external_inputs
  const terminalOutputs = manifest.terminal_outputs

  for (const [label, records] of [['stage', stages], ['guard', guards], ['entrypoint', entrypoints], ['learning', learnings]]) {
    const ids = records.map(record => record?.id).filter(Boolean)
    if (ids.length !== records.length || !unique(ids)) errors.push(`${label} ids must be present and unique`)
  }
  const stageById = new Map(stages.map(stage => [stage.id, stage]))
  const guardById = new Map(guards.map(guard => [guard.id, guard]))
  const entrypointById = new Map(entrypoints.map(entrypoint => [entrypoint.id, entrypoint]))

  for (const stage of stages) {
    if (typeof stage.owner !== 'string' || !stage.owner) errors.push(`stage ${stage.id ?? '<unknown>'} requires one owner`)
    for (const field of ['owned_paths', 'inputs', 'outputs', 'side_effects']) {
      if (!stringArray(stage[field], true) || !unique(stage[field])) errors.push(`stage ${stage.id ?? '<unknown>'} ${field} must be a non-empty unique string array`)
    }
    if (!stringArray(stage.consumed_guards) || !unique(stage.consumed_guards)) errors.push(`stage ${stage.id ?? '<unknown>'} consumed_guards must be a unique string array`)
    if (!stage.retry || !RETRY_MODES.has(stage.retry.mode) || !Number.isInteger(stage.retry.total_attempt_cap) || stage.retry.total_attempt_cap < 1 || typeof stage.retry.checkpoint !== 'string' || !stage.retry.checkpoint) {
      errors.push(`stage ${stage.id ?? '<unknown>'} requires bounded retry mode, total_attempt_cap, and checkpoint`)
    }
    if (!stage.completion || !COMPLETION_SOURCES.has(stage.completion.source) || typeof stage.completion.evidence !== 'string' || !stage.completion.evidence) {
      errors.push(`stage ${stage.id ?? '<unknown>'} completion must use authoritative evidence, not progress or logs`)
    }
  }

  const files = inventory && Array.isArray(inventory.roots) ? inventoryFiles(root, inventory, errors) : []
  for (const file of files) {
    const owners = [
      ...stages.filter(stage => stringArray(stage.owned_paths) && matches(file, stage.owned_paths)).map(stage => `stage:${stage.id}`),
      ...guards.filter(guard => stringArray(guard.owned_paths) && matches(file, guard.owned_paths)).map(guard => `guard:${guard.id}`),
    ]
    if (owners.length !== 1) errors.push(`inventoried executable must have exactly one responsibility owner: ${file} (${owners.length})`)
  }
  for (const stage of stages) {
    if (stringArray(stage.owned_paths, true) && !files.some(file => matches(file, stage.owned_paths))) errors.push(`stage ${stage.id} owns no inventoried executable`)
  }
  for (const guard of guards) {
    if (stringArray(guard.owned_paths, true) && !files.some(file => matches(file, guard.owned_paths))) errors.push(`guard ${guard.id} owns no inventoried executable`)
  }

  const incoming = new Map(stages.map(stage => [stage.id, new Set()]))
  const outgoing = new Map(stages.map(stage => [stage.id, new Set()]))
  const producerByArtifact = new Map()
  for (const stage of stages) for (const artifact of stage.outputs ?? []) {
    if (!producerByArtifact.has(artifact)) producerByArtifact.set(artifact, [])
    producerByArtifact.get(artifact).push(stage.id)
  }
  for (const [artifact, producers] of producerByArtifact) if (producers.length !== 1) errors.push(`artifact must have exactly one producer: ${artifact} (${producers.join(', ')})`)
  for (const artifact of externalInputs) if (producerByArtifact.has(artifact)) errors.push(`artifact cannot be both external and stage-produced: ${artifact}`)
  for (const artifact of terminalOutputs) if (!producerByArtifact.has(artifact)) errors.push(`terminal output has no producer: ${artifact}`)
  const edgeKeys = []
  for (const edge of edges) {
    edgeKeys.push(`${edge?.from}:${edge?.artifact}:${edge?.to}`)
    const from = stageById.get(edge?.from)
    const to = stageById.get(edge?.to)
    if (!from || !to || typeof edge?.artifact !== 'string') { errors.push(`invalid edge: ${JSON.stringify(edge)}`); continue }
    if (!from.outputs.includes(edge.artifact)) errors.push(`edge artifact ${edge.artifact} is not output by ${edge.from}`)
    if (!to.inputs.includes(edge.artifact)) errors.push(`edge artifact ${edge.artifact} is not consumed by ${edge.to}`)
    outgoing.get(edge.from).add(edge.artifact)
    incoming.get(edge.to).add(edge.artifact)
  }
  if (!unique(edgeKeys)) errors.push('edges must be unique')
  for (const stage of stages) {
    for (const input of stage.inputs ?? []) if (!incoming.get(stage.id)?.has(input) && !externalInputs.includes(input)) errors.push(`stage ${stage.id} input has no producer or external declaration: ${input}`)
    for (const output of stage.outputs ?? []) if (!outgoing.get(stage.id)?.has(output) && !terminalOutputs.includes(output)) errors.push(`stage ${stage.id} output has no consumer or terminal declaration: ${output}`)
  }

  for (const guard of guards) {
    if (typeof guard.owner !== 'string' || !guard.owner || !stringArray(guard.owned_paths, true) || !stringArray(guard.required_for, true) || !stringArray(guard.enforced_by, true)) errors.push(`guard ${guard.id ?? '<unknown>'} requires owner, owned_paths, required_for, and enforced_by`)
    for (const stageId of guard.required_for ?? []) {
      const stage = stageById.get(stageId)
      if (!stage) errors.push(`guard ${guard.id} names unknown stage: ${stageId}`)
      else if (!Array.isArray(stage.consumed_guards) || !stage.consumed_guards.includes(guard.id)) errors.push(`required guard ${guard.id} is bypassed by stage ${stageId}`)
    }
    for (const path of guard.enforced_by ?? []) existingRepoFile(root, path, `guard ${guard.id} enforcement`, errors)
  }
  for (const stage of stages) for (const guardId of stage.consumed_guards ?? []) {
    const guard = guardById.get(guardId)
    if (!guard || !Array.isArray(guard.required_for) || !guard.required_for.includes(stage.id)) errors.push(`stage ${stage.id} consumes undeclared guard: ${guardId}`)
  }

  for (const entrypoint of entrypoints) {
    if (!stageById.has(entrypoint.stage) || !['primary', 'recovery'].includes(entrypoint.kind) || typeof entrypoint.path !== 'string') errors.push(`invalid entrypoint ${entrypoint.id ?? '<unknown>'}`)
    else {
      existingRepoFile(root, entrypoint.path, `entrypoint ${entrypoint.id}`, errors)
      if (!matches(entrypoint.path, stageById.get(entrypoint.stage).owned_paths)) errors.push(`entrypoint ${entrypoint.id} is not owned by stage ${entrypoint.stage}`)
    }
  }
  for (const stage of stages) {
    const recovery = entrypointById.get(stage.retry?.recovery_entrypoint)
    if (!recovery || recovery.kind !== 'recovery' || recovery.stage !== stage.id) errors.push(`stage ${stage.id} requires an owned recovery entrypoint`)
  }

  const adjacency = new Map(stages.map(stage => [stage.id, []]))
  for (const edge of edges) if (adjacency.has(edge.from) && stageById.has(edge.to)) adjacency.get(edge.from).push(edge.to)
  const visiting = new Set()
  const visited = new Set()
  const hasCycle = stageId => {
    if (visiting.has(stageId)) return true
    if (visited.has(stageId)) return false
    visiting.add(stageId)
    for (const next of adjacency.get(stageId) ?? []) if (hasCycle(next)) return true
    visiting.delete(stageId)
    visited.add(stageId)
    return false
  }
  if (stages.some(stage => hasCycle(stage.id))) errors.push('stage graph must be acyclic; repeat work through a new run or stage attempt')

  const reachable = new Set(entrypoints.filter(entrypoint => entrypoint.kind === 'primary' && stageById.has(entrypoint.stage)).map(entrypoint => entrypoint.stage))
  if (reachable.size === 0) errors.push('at least one valid primary entrypoint is required')
  let changed = true
  while (changed) {
    changed = false
    for (const edge of edges) if (reachable.has(edge.from) && !reachable.has(edge.to)) {
      reachable.add(edge.to)
      changed = true
    }
  }
  for (const stage of stages) if (!reachable.has(stage.id)) errors.push(`stage is unreachable from a primary entrypoint: ${stage.id}`)

  for (const learning of learnings) {
    if (!stageById.has(learning.owner_stage) || !stringArray(learning.enforced_by, true)) errors.push(`learning ${learning.id ?? '<unknown>'} requires one owner_stage and enforcement checks`)
    for (const path of learning.enforced_by ?? []) existingRepoFile(root, path, `learning ${learning.id} enforcement`, errors)
  }
  return [...new Set(errors)].sort()
}

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--root' || argv[index] === '--manifest') args[argv[index].slice(2)] = argv[++index]
  }
  return args
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2))
  if (!args.root || !args.manifest) {
    console.error('Usage: node check-stage-conveyor.mjs --root <repository> --manifest <manifest.json>')
    process.exit(2)
  }
  const root = resolve(args.root)
  let manifestPath
  try { manifestPath = safePath(root, args.manifest) }
  catch (error) { console.error(`STAGE CONVEYOR INVALID\n- ${error.message}`); process.exit(1) }
  let manifest
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) }
  catch (error) { console.error(`STAGE CONVEYOR INVALID\n- ${error.message}`); process.exit(1) }
  const errors = validateStageConveyor(manifest, root)
  if (errors.length) {
    console.error(`STAGE CONVEYOR INVALID\n${errors.map(error => `- ${error}`).join('\n')}`)
    process.exit(1)
  }
  console.log(`STAGE CONVEYOR VALID: ${manifest.pipeline_id}; ${manifest.stages.length} stages; ${manifest.edges.length} edges; ${manifest.learnings.length} owned learnings`)
}
