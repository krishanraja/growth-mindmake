// Own-pull-requests-only auto-merge (Ruling, Krish, 2026-11-14, decision 1.11).
// Runs the real jq rule .github/workflows/auto-merge.yml runs: only a ready
// pull request of ours, at the commit whose checks passed, merges itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const RULE = '.github/scripts/auto-merge-pick.jq'
const SHA = 'a'.repeat(40)
const OWNER = 'krishanraja'
const ours = {
  number: 7, headRefOid: SHA, isDraft: false, isCrossRepository: false,
  author: { login: 'krishanraja' }, headRepositoryOwner: { login: OWNER },
}
const pick = (prs) =>
  execFileSync('jq', ['-r', '--arg', 'sha', SHA, '--arg', 'owner', OWNER, '-f', RULE], { input: JSON.stringify(prs) }).toString().trim()

test('merges our own ready pull request at the green commit', () => {
  assert.equal(pick([ours]), '7')
})
test('merges a pull request the Actions bot opened', () => {
  assert.equal(pick([{ ...ours, author: { login: 'app/github-actions', is_bot: true } }]), '7')
})
test('never merges a fork', () => {
  assert.equal(pick([{ ...ours, isCrossRepository: true }]), '')
  assert.equal(pick([{ ...ours, headRepositoryOwner: { login: 'stranger' } }]), '')
})
test('never merges a stranger, even on our own branch', () => {
  assert.equal(pick([{ ...ours, author: { login: 'stranger' } }]), '')
  assert.equal(pick([{ ...ours, author: null }]), '')
})
test('leaves drafts and other commits alone', () => {
  assert.equal(pick([{ ...ours, isDraft: true }]), '')
  assert.equal(pick([{ ...ours, headRefOid: 'b'.repeat(40) }]), '')
  assert.equal(pick([]), '')
})
test('the workflow waits on this repository\'s own checks and refuses a run from elsewhere', () => {
  const wf = readFileSync('.github/workflows/auto-merge.yml', 'utf8')
  assert.match(wf, /workflows: \["Verify growth engine"\]/)
  assert.match(wf, /CHECKS: Verify growth engine\n/)
  assert.match(wf, /workflow_run\.head_repository\.full_name == github\.repository/)
  assert.match(wf, /workflow_run\.event == 'pull_request'/)
  assert.match(wf, /-f \.github\/scripts\/auto-merge-pick\.jq/)
  assert.match(wf, /isCrossRepository,author,headRepositoryOwner/)
})

// A merge made with the Actions token starts no push workflow, so ci.yml's fold job never ran after one and closeout
// notes waited on main (found 2026-11-14). The merge now starts ci.yml on main by workflow_dispatch, and the fold runs on it.
test('a merge starts CI on main, and its fold job runs on that start', () => {
  const wf = readFileSync('.github/workflows/auto-merge.yml', 'utf8')
  assert.match(wf, /\n  actions: write\n/)
  assert.match(wf, /gh pr merge "\$pr"[^\n]*\n[^\n]*\n\s*#[^\n]*\n\s*gh workflow run ci\.yml -R "\$REPO" --ref main/)
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8')
  assert.match(ci, /\non:\n(?:  [^\n]*\n|    [^\n]*\n)*  workflow_dispatch:\n/)
  const fold = ci.slice(ci.indexOf('\n  fold:\n'))
  assert.match(fold, /\n    if: \(github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'\) && github\.ref == 'refs\/heads\/main'\n/)
  assert.match(fold, /node "\$hook" --fold/)
})

// Nor did a bot merge start the live run a src/ change owes (operate.yml's push trigger), so #151 merged on 18 November
// and no run followed. A merge that changed src/ now starts operate.yml's dry dispatch, which never sends.
test('a merge that changes the engine starts the dry live run, and only then', () => {
  const wf = readFileSync('.github/workflows/auto-merge.yml', 'utf8')
  assert.match(wf, /gh pr view "\$pr" -R "\$REPO" --json files --jq '\[\.files\[\]\.path \| select\(startswith\("src\/"\)\)\] \| length'/)
  assert.match(wf, /if \[ "\$\{engine:-0\}" != "0" \]; then\n\s*gh workflow run operate\.yml -R "\$REPO" --ref main -f mode=dispatch -f commit=false/)
  const operate = readFileSync('.github/workflows/operate.yml', 'utf8')
  assert.match(operate, /inputs\.mode == 'dispatch'/)
  assert.match(operate, /if: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.commit \}\}/, 'a write-enabled dispatch is still refused')
})
