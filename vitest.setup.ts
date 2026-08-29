import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { config } from 'dotenv'
import { afterEach } from 'vitest'

config({ path: '.env.test', quiet: true })
config({ path: '.env', quiet: true })

// React Testing Library only auto-cleans when Vitest globals are enabled. Without this,
// each render stacks up in the same document and queries match earlier tests' output.
afterEach(cleanup)
