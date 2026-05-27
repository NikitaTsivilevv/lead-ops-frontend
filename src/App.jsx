import { Toaster } from "@/components/ui/toaster"
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

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<RoleHome />} />
    <Route path="/login" element={<AuthGate />} />
    <Route path="/intake" element={<RequireAuth allow={['caller','admin']}><Intake /></RequireAuth>} />
    <Route path="/leads" element={<RequireAuth allow={['admin','operations','confirmation','client']}><Leads /></RequireAuth>} />
    <Route path="/confirmation" element={<RequireAuth allow={['admin','operations','confirmation']}><Confirmation /></RequireAuth>} />
    <Route path="/appointments/:id" element={<RequireAuth allow={['admin','operations','confirmation','client']}><AppointmentDetail /></RequireAuth>} />
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
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App