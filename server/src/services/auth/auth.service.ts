import User, { IUser } from '../../models/User'

export async function findOrCreateGoogleUser(profile: {
  id: string
  emails?: Array<{ value: string }>
  displayName?: string
  photos?: Array<{ value: string }>
}, accessToken: string, refreshToken: string): Promise<IUser> {
  const googleId = profile.id
  const email = profile.emails?.[0]?.value || ''
  const name = profile.displayName || ''
  const picture = profile.photos?.[0]?.value || ''

  let user = await User.findOne({ googleId })

  if (!user) {
    user = new User({
      googleId,
      email,
      name,
      picture,
      accessToken,
      refreshToken,
    })
  } else {
    user.email = email || user.email
    user.name = name || user.name
    user.picture = picture || user.picture
    user.accessToken = accessToken || user.accessToken
    if (refreshToken) user.refreshToken = refreshToken
  }

  await user.save()
  return user
}
