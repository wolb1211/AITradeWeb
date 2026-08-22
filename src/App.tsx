import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { PublicLayout } from './layouts/PublicLayout'
import { RequireAuth } from './components/RequireAuth'
import { RequireVip } from './components/RequireVip'
import { ForgotPasswordPage, LoginPage, RegisterPage, VerifyEmailPage } from './pages/AuthPages'
import {
  AgentCenterPage, DashboardPage, EaDownloadsPage, OrdersPage, ProfilePage, SecurityPage, StrategiesPage,
  StrategyCreatePage, StrategyDetailPage, UsagePage, WalletPage,
} from './pages/AppPages'
import { GuideDetailPage, GuidePage, HomePage, LegalPage, OfficialStrategiesPage } from './pages/PublicPages'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/official-strategies" element={<OfficialStrategiesPage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/guide/:id" element={<GuideDetailPage />} />
        <Route path="/terms" element={<LegalPage type="terms" />} />
        <Route path="/privacy" element={<LegalPage type="privacy" />} />
      </Route>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="strategies" element={<StrategiesPage />} />
        <Route path="strategies/new" element={<RequireVip><StrategyCreatePage /></RequireVip>} />
        <Route path="strategies/:id" element={<StrategyDetailPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="usage" element={<UsagePage />} />
        <Route path="ea-downloads" element={<EaDownloadsPage />} />
        <Route path="agent" element={<AgentCenterPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="security" element={<SecurityPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
