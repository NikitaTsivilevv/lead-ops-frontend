import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

const ROLE_LABELS = {
  admin: 'Admin',
  operations: 'Operations',
  confirmation: 'Confirmation',
  client: 'Client',
  caller: 'Caller',
};

export default function AppHeader() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <header className="border-b bg-background sticky top-0 z-30">
      <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-semibold tracking-tight hover:opacity-80">
          lead-ops
        </Link>

        {/* Role-aware nav */}
        <nav className="flex items-center gap-1 ml-4">
          {user.role !== 'caller' && (
            <NavLink
              to="/leads"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm transition-colors ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`
              }
            >
              Leads
            </NavLink>
          )}
          {['admin', 'operations', 'confirmation'].includes(user.role) && (
            <NavLink
              to="/confirmation"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm transition-colors ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`
              }
            >
              Confirmation
            </NavLink>
          )}
          {user.role === 'caller' && (
            <NavLink
              to="/intake"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm transition-colors ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`
              }
            >
              New lead
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            <span className="hidden sm:inline">{user.email}</span>
            <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {ROLE_LABELS[user.role] || user.role}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { logout(); window.location.href = '/login'; }}
          >
            <LogOut className="w-4 h-4 mr-1" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}