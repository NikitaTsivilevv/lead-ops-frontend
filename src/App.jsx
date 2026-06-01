import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from '@/components/ui/sonner'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import ScrollToTop from './components/ScrollToTop';
import { AuthProvider } from '@/lib/LeadOpsAuthContext';
import { RoleHome, RequireAuth } from '@/lib/RoleRouter';
import AuthGate from '@/pages/AuthGate';
import Intake from '@/pages/Intake';
import Leads from '@/pages/Leads';
import Confirmation from '@/pages/Confirmation';
import AppointmentDetail from '@/pages/AppointmentDetail';
import Calendar from '@/pages/Calendar';
import AvailabilityEditor from '@/pages/AvailabilityEditor';
import Pipeline from '@/pages/Pipeline';
import MyLeads from '@/pages/MyLeads';
import AdminCallers from '@/pages/AdminCallers';
import AdminClients from '@/pages/AdminClients';
import AcceptInvite from '@/pages/AcceptInvite';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<RoleHome />} />
    <Route path="/login" element={<AuthGate />} />
    <Route path="/accept-invite" element={<AcceptInvite />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/intake" element={<RequireAuth allow={['caller','admin']}><Intake /></RequireAuth>} />
    <Route path="/my-leads" element={<RequireAuth allow={['caller','admin']}><MyLeads /></RequireAuth>} />
    <Route path="/leads" element={<RequireAuth allow={['admin','operations','confirmation','client','qa']}><Leads /></RequireAuth>} />
    <Route path="/confirmation" element={<RequireAuth allow={['admin','operations','confirmation']}><Confirmation /></RequireAuth>} />
    <Route path="/appointments/:id" element={<RequireAuth allow={['admin','operations','confirmation','client','qa']}><AppointmentDetail /></RequireAuth>} />
    <Route path="/pipeline" element={<RequireAuth allow={['admin','operations','confirmation','client']}><Pipeline /></RequireAuth>} />
    <Route path="/calendar" element={<RequireAuth allow={['admin','operations','confirmation','client']}><Calendar /></RequireAuth>} />
    <Route path="/calendar/availability" element={<RequireAuth allow={['admin','operations','client']}><AvailabilityEditor /></RequireAuth>} />
    <Route path="/admin/callers" element={<RequireAuth allow={['admin']}><AdminCallers /></RequireAuth>} />
    <Route path="/admin/clients" element={<RequireAuth allow={['admin']}><AdminClients /></RequireAuth>} />
    <Route path="*" element={<PageNotFound />} />
  </Routes>
);

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <AppRoutes />
        </Router>
        <Toaster />
        <SonnerToaster position="bottom-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App