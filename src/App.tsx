import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { PublicLayout } from './layouts/PublicLayout'
import { RequireAuth } from './components/RequireAuth'
import { RequireVip } from './components/RequireVip'
import { SHOW_OFFICIAL_STRATEGIES } from './config/features'
import { ForgotPasswordPage, LoginPage, RegisterPage, VerifyEmailPage } from './pages/AuthPages'
import {
  AgentCenterPage, DashboardPage, EaDownloadsPage, OrdersPage, ProfilePage, SecurityPage, StrategiesPage,
  CustomAiStrategyCreatePage, StrategyDetailPage, StrategyLibraryCreatePage, UsagePage, WalletPage, WorkflowPrototypePage,
} from './pages/AppPages'
import { CustomStrategyIntroPage, GuideDetailPage, GuidePage, HomePage, LegalPage, OfficialStrategiesPage, PricingPage } from './pages/PublicPages'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        {SHOW_OFFICIAL_STRATEGIES && <Route path="/official-strategies" element={<OfficialStrategiesPage />} />}
        <Route path="/custom-strategy" element={<CustomStrategyIntroPage />} />
        <Route path="/pricing" element={<PricingPage />} />
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
        <Route path="strategies/new" element={<Navigate to="/app/strategies/new/library" replace />} />
        <Route path="strategies/new/library" element={<RequireVip><StrategyLibraryCreatePage /></RequireVip>} />
        <Route path="strategies/new/custom" element={<RequireVip><CustomAiStrategyCreatePage /></RequireVip>} />
        <Route path="strategies/workflow-prototype" element={<RequireVip><WorkflowPrototypePage /></RequireVip>} />
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
