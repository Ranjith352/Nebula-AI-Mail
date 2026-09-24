import { getGoogleOAuth2Client } from '../../config/google'

export async function refreshAccessToken(refreshToken: string) {
  const oAuth2Client = getGoogleOAuth2Client()
  oAuth2Client.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await oAuth2Client.refreshAccessToken()
  return credentials
}
