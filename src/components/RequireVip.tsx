import { type ReactNode, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { apiRequest, clearSession, saveStoredUser, type AuthUser } from '../lib/api'

export function RequireVip({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [invalidSession, setInvalidSession] = useState(false)

  useEffect(() => {
    apiRequest<AuthUser>('/api/v1/auth/me')
      .then((latestUser) => { saveStoredUser(latestUser); setUser(latestUser) })
      .catch(() => { clearSession(); setInvalidSession(true) })
  }, [])

  if (invalidSession) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!user) return <div className="permission-loading">正在检查账户权限…</div>
  if (!user.vip_active) return <Navigate to="/app/strategies" replace state={{ vipRequired: true }} />
  return children
}
