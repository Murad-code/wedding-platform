import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/** Applied wherever an invitation token appears in the URL path (docs/SECURITY.md §2). */
const TOKEN_URL_HEADERS = [
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
]

/**
 * A deliberately partial Content-Security-Policy.
 *
 * These four directives are the ones that can be set without breaking anything: they stop
 * a `<base>` tag rewriting every relative URL, stop an injected form posting elsewhere,
 * remove plugin embedding, and replace `X-Frame-Options` with its modern equivalent.
 *
 * `script-src` and `style-src` are **not** set. Doing so properly needs a per-request
 * nonce threaded through the proxy and both root layouts, and Payload's admin bundle
 * would need auditing alongside it. Setting them loosely — with `unsafe-inline` — would
 * be worse than nothing: it would look like a policy while permitting exactly the
 * injection a policy exists to stop. Recorded as outstanding in
 * `docs/IMPLEMENTATION_PLAN.md` rather than pretended.
 */
const BASELINE_CSP = [
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ')

const nextConfig: NextConfig = {
  // Standalone output keeps the production image small (see docs/CLIENT_DEPLOYMENT.md).
  output: process.env.NEXT_OUTPUT_STANDALONE === 'true' ? 'standalone' : undefined,
  images: {
    localPatterns: [{ pathname: '/api/media/file/**' }],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: BASELINE_CSP },
        ],
      },
      {
        // Invitation tokens live in the URL path. Keep them out of referrers,
        // out of search engines, and out of shared caches. See docs/SECURITY.md §2.
        source: '/invite/:path*',
        headers: TOKEN_URL_HEADERS,
      },
      {
        // The wedding-day photo screen is token-scoped in exactly the same way, and
        // needs exactly the same treatment. `/photos` on its own is public and is
        // deliberately not matched by this single-segment pattern.
        source: '/photos/:token',
        headers: TOKEN_URL_HEADERS,
      },
      {
        // Payload admin is a maintenance tool, not a page anyone should find.
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        // Defence in depth for uploaded files. The real mitigation is that only raster
        // images are accepted and sharp re-processes them (see collections/Media.ts);
        // this makes a file that somehow got through inert if a browser renders it.
        source: '/api/media/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "sandbox; default-src 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ]
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
