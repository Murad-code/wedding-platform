import jsQR from 'jsqr'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { INVITATION_QR_OPTIONS, invitationQrFilename } from '@/domain/invitations/qr'
import { generateInvitationToken } from '@/domain/invitations/token'

async function decode(png: Buffer): Promise<string | null> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null
}

describe('invitation QR codes', () => {
  it('decode back to the exact invitation link', async () => {
    // A long real domain plus a real 43-character token is the worst case we print.
    const url = `https://sarah-and-adam-get-married.example.co.uk/invite/${generateInvitationToken()}`
    const png = await QRCode.toBuffer(url, { ...INVITATION_QR_OPTIONS, width: 512 })

    expect(await decode(png)).toBe(url)
  })

  it('still decode with part of the code obscured, as on a scuffed card', async () => {
    const url = `https://example.com/invite/${generateInvitationToken()}`
    const png = await QRCode.toBuffer(url, { ...INVITATION_QR_OPTIONS, width: 512 })
    const { width = 512 } = await sharp(png).metadata()

    // A white band across the lower middle, away from the three finder patterns.
    const band = await sharp({
      create: {
        width: Math.round(width * 0.35),
        height: Math.round(width * 0.08),
        channels: 4,
        background: '#ffffff',
      },
    })
      .png()
      .toBuffer()
    const damaged = await sharp(png)
      .composite([{ input: band, left: Math.round(width * 0.4), top: Math.round(width * 0.62) }])
      .png()
      .toBuffer()

    expect(await decode(damaged)).toBe(url)
  })
})

describe('invitationQrFilename', () => {
  it('names the file after the household', () => {
    expect(invitationQrFilename('The Kamali Family', 'svg')).toBe(
      'invitation-the-kamali-family.svg',
    )
  })

  it('copes with accents, ampersands, and punctuation', () => {
    expect(invitationQrFilename('Tom & Zoë O’Brien!', 'png')).toBe('invitation-tom-zoe-o-brien.png')
  })

  it('falls back to a plain name when nothing usable is left', () => {
    expect(invitationQrFilename('🎉🎉', 'svg')).toBe('invitation.svg')
  })

  it('keeps very long names to a sensible length', () => {
    const name = invitationQrFilename('A'.repeat(200), 'png')
    expect(name.length).toBeLessThanOrEqual('invitation-.png'.length + 60)
  })
})
