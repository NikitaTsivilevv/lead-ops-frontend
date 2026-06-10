import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient } from '@/api/apiClient';
import ProfilesTab    from './AdminPayroll/ProfilesTab';
import AssignmentsTab from './AdminPayroll/AssignmentsTab';
import AttendanceTab  from './AdminPayroll/AttendanceTab';
import OverheadTab    from './AdminPayroll/OverheadTab';
import CostSummaryTab from './AdminPayroll/CostSummaryTab';

const TABS = ['Profiles', 'Assignments', 'Attendance', 'Overhead', 'Cost Summary'];

export default function AdminPayroll() {
  const [tab, setTab] = useState('Profiles');

  const callerUsers = useQuery({ queryKey: ['caller-users'], queryFn: () => apiClient.listCallers() });
  const clients     = useQuery({ queryKey: ['clients'],      queryFn: () => apiClient.listClients() });

  const callers    = callerUsers.data?.callers  || [];
  const clientList = clients.data?.clients || [];

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-[1200px] mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Payroll</h1>

        <div className="flex gap-0 border-b overflow-x-auto overflow-y-hidden">
          {TABS.map((t, i) => (
            <button
              key={`${i}-${t}`}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {tab === 'Profiles' && (
              callerUsers.isLoading
                ? <p className="text-muted-foreground">Loading…</p>
                : <ProfilesTab callers={callers} />
            )}
            {tab === 'Assignments' && (
              callerUsers.isLoading || clients.isLoading
                ? <p className="text-muted-foreground">Loading…</p>
                : <AssignmentsTab callers={callers} clients={clientList} />
            )}
            {tab === 'Attendance' && (
              callerUsers.isLoading
                ? <p className="text-muted-foreground">Loading…</p>
                : <AttendanceTab callers={callers} />
            )}
            {tab === 'Overhead' && <OverheadTab />}
            {tab === 'Cost Summary' && (
              clients.isLoading
                ? <p className="text-muted-foreground">Loading…</p>
                : <CostSummaryTab clients={clientList} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
