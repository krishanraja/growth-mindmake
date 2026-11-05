/**
 * The AI mirror's questions (protocol 1.19.0, features.mirror).
 *
 * Ruling (Krish, 2026-11-05): before he meets someone, show them privately
 * what the AI answer engines say about them and their companies. Control
 * Center runs these on his press (api/_mirror.ts) against Perplexity, ChatGPT,
 * Claude and Gemini, and reads them against what it knows. The questions are the
 * engine's: what a curious stranger would ask, so the mirror shows the
 * person how they are found, not how they would like to be. {name} and
 * {company} are the only fills. Pure.
 */

export const MIRROR_VERSION = '1.19.0';
export const MIRROR_QUESTIONS = [
  'Who is {name}?',
  'What is {name} best known for, and what have they built?',
  'What has {company} done in the last two years, and what is {name}\'s part in it?',
  'What does {name} think about AI, and what have they said about it in public?',
  'Who are the people and companies most often mentioned alongside {name}?',
  'What would someone meeting {name} for the first time want to know?'
];

/** The plan a report carries. Pure. */
export const mirrorPlan = () => ({ version: 1, questions: [...MIRROR_QUESTIONS] });

/** Whether a run may send the plan: Control Center runs mirrors here, serves 1.19.0, and the schema copied here has it. Pure. */
export function takesMirror(capabilities, schema) {
  return capabilities?.features?.mirror === true && Array.isArray(capabilities?.schema_versions) && capabilities.schema_versions.includes(MIRROR_VERSION) && !!schema?.properties?.mirror;
}
