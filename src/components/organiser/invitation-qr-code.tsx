'use client'

import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

import {
  INVITATION_QR_OPTIONS,
  INVITATION_QR_PNG_WIDTH,
  invitationQrFilename,
} from '@/domain/invitations/qr'

type Rendered = { svg: string; png: string }

/**
 * The household's invitation as a QR code for printing.
 *
 * Generated here in the browser from the link already on screen: the raw token exists only
 * in this response, so it never goes back to the server or to a third-party QR service.
 */
export function InvitationQrCode({ url, partyName }: { url: string; partyName: string }) {
  const [rendered, setRendered] = useState<Rendered | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let current = true

    Promise.all([
      QRCode.toString(url, { ...INVITATION_QR_OPTIONS, type: 'svg' }),
      QRCode.toDataURL(url, { ...INVITATION_QR_OPTIONS, width: INVITATION_QR_PNG_WIDTH }),
    ])
      .then(([svg, png]) => {
        if (current)
          setRendered({ svg: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, png })
      })
      .catch(() => {
        if (current) setFailed(true)
      })

    return () => {
      current = false
    }
  }, [url])

  if (failed) {
    return (
      <p role="alert" className="text-sm text-status-declined">
        The QR code could not be made. The link above still works.
      </p>
    )
  }

  if (!rendered) return <p className="text-sm text-organiser-muted">Making the QR code…</p>

  const download =
    'rounded-md border border-organiser-border px-3 py-1.5 text-sm font-medium hover:bg-organiser-surface'

  return (
    <figure className="flex flex-wrap items-start gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- a data URL, which next/image cannot optimise */}
      <img
        src={rendered.svg}
        alt={`QR code for ${partyName}’s invitation`}
        width={160}
        height={160}
        className="rounded-md border border-organiser-border bg-white"
      />
      <figcaption className="max-w-sm space-y-3 text-sm">
        <p className="text-organiser-muted">
          Print this on their invitation. Anyone holding the card can open and answer this
          household’s invitation, exactly as with the link.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={rendered.svg}
            download={invitationQrFilename(partyName, 'svg')}
            className={download}
          >
            Download SVG<span className="sr-only"> QR code for {partyName}</span>
          </a>
          <a
            href={rendered.png}
            download={invitationQrFilename(partyName, 'png')}
            className={download}
          >
            Download PNG<span className="sr-only"> QR code for {partyName}</span>
          </a>
        </div>
        <p className="text-xs text-organiser-muted">
          SVG is best for a printer or stationer; it stays sharp at any size.
        </p>
      </figcaption>
    </figure>
  )
}
