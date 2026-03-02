import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import ZAI from 'z-ai-web-dev-sdk'

// Cache for ZAI instance
let zaiInstance: any = null

/**
 * Get the directory of the current module
 */
function getCurrentDir(): string {
  try {
    // For ESM
    const __filename = fileURLToPath(import.meta.url)
    return dirname(__filename)
  } catch (e) {
    // Fallback for CommonJS
    return process.cwd()
  }
}

/**
 * Initialize ZAI SDK with configuration from environment variables
 * Creates a temporary config file at runtime since the SDK requires a file
 */
export async function initializeZAI(): Promise<any> {
  // Return cached instance if available
  if (zaiInstance) {
    console.log('[ZAI Client] Using cached ZAI instance')
    return zaiInstance
  }

  console.log('[ZAI Client] Initializing ZAI SDK...')

  // Check for required environment variables
  const baseUrl = process.env.ZAI_BASE_URL || process.env.NEXT_PUBLIC_ZAI_BASE_URL
  const apiKey = process.env.ZAI_API_KEY || process.env.NEXT_PUBLIC_ZAI_API_KEY
  const chatId = process.env.ZAI_CHAT_ID || process.env.NEXT_PUBLIC_ZAI_CHAT_ID || ''
  const userId = process.env.ZAI_USER_ID || process.env.NEXT_PUBLIC_ZAI_USER_ID || ''

  if (!baseUrl || !apiKey) {
    console.error('[ZAI Client] Missing required configuration:')
    console.error('[ZAI Client] - ZAI_BASE_URL:', baseUrl ? '✓' : '✗')
    console.error('[ZAI Client] - ZAI_API_KEY:', apiKey ? '✓ (set)' : '✗ (missing)')

    const errorMsg = 'ZAI SDK configuration missing. Please set the following environment variables in Vercel:\n' +
      '- ZAI_BASE_URL: Your ZAI API base URL\n' +
      '- ZAI_API_KEY: Your ZAI API key\n\n' +
      'Optional:\n' +
      '- ZAI_CHAT_ID: Chat ID (if required)\n' +
      '- ZAI_USER_ID: User ID (if required)\n\n' +
      'See VERCEL_ENV_SETUP.md for detailed instructions.'

    console.error('[ZAI Client]', errorMsg)
    throw new Error(errorMsg)
  }

  // Try multiple locations for the config file
  const possibleDirs = [
    tmpdir(),
    getCurrentDir(),
    process.cwd(),
    '/tmp'
  ]

  let configCreated = false
  let lastError: Error | null = null
  let configPath = ''

  for (const dir of possibleDirs) {
    try {
      // Ensure directory exists
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      configPath = join(dir, '.z-ai-config')
      const config = {
        baseUrl,
        apiKey,
        chatId,
        userId
      }

      writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
      console.log(`[ZAI Client] Created config file at: ${configPath}`)
      configCreated = true
      break
    } catch (error) {
      console.warn(`[ZAI Client] Could not create config in ${dir}:`, error instanceof Error ? error.message : error)
      lastError = error as Error
      continue
    }
  }

  if (!configCreated) {
    const errorMsg = `Failed to create ZAI config file in any location. Last error: ${lastError?.message || 'Unknown'}`
    console.error('[ZAI Client]', errorMsg)
    throw new Error(errorMsg)
  }

  try {
    // Set HOME to the directory containing the config file
    const configDir = dirname(configPath)
    const oldHome = process.env.HOME

    // Try setting HOME to point to config directory
    if (!oldHome) {
      process.env.HOME = configDir
    }

    try {
      zaiInstance = await ZAI.create()
      console.log('[ZAI Client] ✅ ZAI SDK initialized successfully')

      // Clean up config file
      try {
        if (existsSync(configPath)) {
          unlinkSync(configPath)
          console.log('[ZAI Client] Cleaned up config file')
        }
      } catch (cleanupError) {
        console.warn('[ZAI Client] Could not clean up config file:', cleanupError)
      }

      return zaiInstance
    } finally {
      // Restore original HOME
      if (oldHome) {
        process.env.HOME = oldHome
      } else {
        delete process.env.HOME
      }
    }
  } catch (error) {
    console.error('[ZAI Client] ❌ Failed to initialize ZAI SDK:', error)

    // Clean up config file on error
    try {
      if (existsSync(configPath)) {
        unlinkSync(configPath)
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    const detailedError = `ZAI SDK initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
      'Please ensure the following environment variables are set correctly in Vercel:\n' +
      '- ZAI_BASE_URL\n' +
      '- ZAI_API_KEY\n\n' +
      'See VERCEL_ENV_SETUP.md for detailed setup instructions.'

    console.error('[ZAI Client]', detailedError)
    throw new Error(detailedError)
  }
}

/**
 * Get or create ZAI SDK instance
 */
export async function getZAIClient(): Promise<any> {
  if (!zaiInstance) {
    zaiInstance = await initializeZAI()
  }
  return zaiInstance
}

/**
 * Reset ZAI SDK instance (useful for testing or re-initialization)
 */
export function resetZAIClient(): void {
  zaiInstance = null
  console.log('[ZAI Client] ZAI instance reset')
}
