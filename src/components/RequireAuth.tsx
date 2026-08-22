import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { hasSession } from '../lib/api'

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  if (!hasSession()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}
