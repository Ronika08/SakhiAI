import { describe, it, expect } from 'vitest'
import { authorize, protect } from '../middleware/authMiddleware.js'
import jwt from 'jsonwebtoken'

const call = (mw, req) => new Promise((resolve) => mw(req, {}, (err) => resolve(err)))

describe('authorization', () => {
  it('authorize(admin) rejects regular users with 403 and anonymous with 401', async () => {
    expect((await call(authorize('admin'), { user: { id: '1', role: 'user' } })).statusCode).toBe(403)
    expect((await call(authorize('admin'), {})).statusCode).toBe(401)
    expect(await call(authorize('admin'), { user: { id: '1', role: 'admin' } })).toBeUndefined()
  })
  it('protect only accepts HS256 tokens signed with the server secret', async () => {
    const good = jwt.sign({ id: 'u1', role: 'user' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' })
    const req = { headers: { authorization: `Bearer ${good}` } }
    expect(await call(protect, req)).toBeUndefined()
    expect(req.user).toEqual({ id: 'u1', role: 'user' })
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ id: 'x' })).toString('base64url') + '.'
    expect((await call(protect, { headers: { authorization: `Bearer ${none}` } })).statusCode).toBe(401)
    expect((await call(protect, { headers: {} })).statusCode).toBe(401)
  })
  it('a role claim in a token cannot be escalated without the secret', async () => {
    const forged = jwt.sign({ id: 'u1', role: 'admin' }, 'wrong-secret')
    expect((await call(protect, { headers: { authorization: `Bearer ${forged}` } })).statusCode).toBe(401)
  })
})
