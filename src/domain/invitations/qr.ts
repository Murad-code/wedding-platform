/**
 * QR codes for printed invitations.
 *
 * A code encodes the household's private invitation link, so a printed card is a key in
 * the same way the link is (docs/SECURITY.md §2).
 */

export const INVITATION_QR_OPTIONS = {
  // 'Q' recovers from 25% damage: printed cards get folded, scuffed, and photographed badly.
  errorCorrectionLevel: 'Q',
  // The QR specification's minimum quiet zone; less and phone cameras struggle.
  margin: 4,
} as const

/** Big enough to stay sharp on a printed card at any sensible size. */
export const INVITATION_QR_PNG_WIDTH = 1024

/** `invitation-the-kamali-family.svg`: the party name, never the token. */
export function invitationQrFilename(partyName: string, extension: 'svg' | 'png'): string {
  const slug = partyName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')

  return `invitation${slug ? `-${slug}` : ''}.${extension}`
}
