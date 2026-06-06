#!/usr/bin/env node
/**
 * Forge OS — Logo Generation via Google Imagen 3
 *
 * Generates 4 logo concept variants and saves them to app/public/generated/
 * Usage: node scripts/generate-logo.mjs
 *
 * Requires: GEMINI_API_KEY in environment or .env.local
 */

import { GoogleGenAI } from '@google/genai'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'app', 'public', 'generated')

// Load .env.local manually if not already in env
function loadEnv() {
  try {
    const env = readFileSync(join(ROOT, 'app', '.env.local'), 'utf8')
    for (const line of env.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const [k, ...rest] = trimmed.split('=')
      if (k && rest.length && !process.env[k]) {
        process.env[k] = rest.join('=').trim()
      }
    }
  } catch {}
}

loadEnv()

const API_KEY = process.env.GEMINI_API_KEY
if (!API_KEY) {
  console.error('GEMINI_API_KEY not set. Add it to app/.env.local or export it.')
  process.exit(1)
}

const ai = new GoogleGenAI({ apiKey: API_KEY })

mkdirSync(OUT_DIR, { recursive: true })

/**
 * Brand context for prompts:
 * - Dark theme: near-black background #09090b
 * - Brand colour: orange #f97316
 * - Product: AI agent OS, web3/blockchain, smart accounts, delegation
 * - Aesthetic: precise, technical, minimal, premium — not cartoonish
 */
const CONCEPTS = [
  {
    name: 'concept-anvil-flame',
    prompt: `Minimal flat vector logo icon for a software product called "ForgeOS".
A stylised metal anvil with a single bright orange flame rising from its surface.
Pure black background. Orange flame glows warm (#f97316).
The anvil is dark charcoal grey with clean geometric edges.
Centered composition, square canvas, generous padding.
Flat design, no gradients, no shadows, no text, no words.
Professional tech startup logo. High contrast.`,
  },
  {
    name: 'concept-hexagon-spark',
    prompt: `Minimal flat vector logo icon for "ForgeOS", an AI operating system.
A bold regular hexagon outline in deep charcoal on pure black background.
Inside the hexagon: a single bright orange spark / lightning bolt / flame shape
in orange (#f97316). Very clean, geometric, symmetric.
Square canvas with ample margin. No text, no letters, no gradients.
Flat icon style, like a modern cryptocurrency or developer tool logo.
Ultra minimal, high contrast.`,
  },
  {
    name: 'concept-circuit-hammer',
    prompt: `Minimal vector logo mark for a tech product called ForgeOS.
A stylised hammer silhouette with circuit board trace lines extending from its head.
Pure black background. Hammer head in dark zinc grey.
Circuit traces glow in bright orange (#f97316).
Clean geometric shapes, flat design, no text, no letters, square canvas with padding.
Professional software startup aesthetic, reminiscent of Linear or Vercel logos.`,
  },
  {
    name: 'concept-letter-f-forge',
    prompt: `Minimal flat logo icon: a bold capital letter F made of forge/fire imagery.
The F letterform is constructed from three rectangular bars in bright orange (#f97316)
on a near-black background (#09090b).
At the tip of the top horizontal bar of the F, a small bright glowing dot or spark.
Rounded corners on each bar. Clean, modern, geometric.
Like the Figma or Linear logo treatment — pure icon, no text, square canvas with padding.
Flat design, crisp edges, no shadows.`,
  },
]

async function generateConcept(concept) {
  console.log(`\nGenerating: ${concept.name}…`)

  try {
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-001',
      prompt: concept.prompt,
      config: {
        numberOfImages: 2,
        aspectRatio: '1:1',
        safetyFilterLevel: 'BLOCK_ONLY_HIGH',
      },
    })

    if (!response.generatedImages?.length) {
      console.warn(`  No images returned for ${concept.name}`)
      return
    }

    response.generatedImages.forEach((img, i) => {
      const bytes = Buffer.from(img.image.imageBytes, 'base64')
      const filename = `${concept.name}-${i + 1}.png`
      const outPath = join(OUT_DIR, filename)
      writeFileSync(outPath, bytes)
      console.log(`  Saved: public/generated/${filename}`)
    })
  } catch (err) {
    console.error(`  Error generating ${concept.name}:`, err?.message ?? err)
  }
}

async function main() {
  console.log('Forge OS — Logo Generation via Google Imagen 3')
  console.log(`Output: ${OUT_DIR}\n`)

  for (const concept of CONCEPTS) {
    await generateConcept(concept)
  }

  console.log('\nDone. Open public/generated/ to review concepts.')
  console.log('Drag any PNG into your browser or use:')
  console.log('  open app/public/generated/')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
