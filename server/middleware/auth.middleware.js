/**
 * Middleware: ensure the request comes from an authenticated session.
 * Attaches req.user (Mongoose User document) via passport.
 */
function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next()
  }
  res.status(401).json({ message: 'Unauthorized — please log in.' })
}

module.exports = { requireAuth }
