import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LogOut, Menu, Bell } from 'lucide-react';
import { roleLabel } from '@/lib/roles';
import { apiClient } from '@/api/apiClient';

function NavLinks({ user, onClick }) {
  const linkClass = ({ isActive }) =>
    `flex items-center px-3 py-2 rounded-md text-sm transition-colors ${
      isActive
        ? 'text-foreground font-medium bg-blue-200'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
    }`;

  return (
    <>
      {!['caller', 'qa'].includes(user.role) && (
        <NavLink to="/pipeline" className={linkClass} onClick={onClick}>Pipeline</NavLink>
      )}
      {!['caller', 'qa'].includes(user.role) && (
        <NavLink to="/calendar" className={linkClass} onClick={onClick}>Calendar</NavLink>
      )}
      {user.role !== 'caller' && (
        <NavLink to="/leads" className={linkClass} onClick={onClick}>Leads</NavLink>
      )}
      {['admin', 'operations', 'confirmation', 'call_center_admin'].includes(user.role) && (
        <NavLink to="/confirmation" className={linkClass} onClick={onClick}>Confirmation</NavLink>
      )}
      {['admin', 'operations', 'confirmation', 'call_center_admin', 'client'].includes(user.role) && (
        <NavLink to="/conversations" className={linkClass} onClick={onClick}>Conversations</NavLink>
      )}
      {['caller','confirmation'].includes(user.role) && (
        <NavLink to="/intake" className={linkClass} onClick={onClick}>New lead</NavLink>
      )}
      {['caller', 'confirmation'].includes(user.role) && (
        <NavLink to="/my-leads" className={linkClass} onClick={onClick}>My Leads</NavLink>
      )}
      {user.role === 'admin' && (
        <>
          <NavLink to="/admin/clients" className={linkClass} onClick={onClick}>Clients</NavLink>
          <NavLink to="/admin/callers" className={linkClass} onClick={onClick}>Callers</NavLink>
          <NavLink to="/admin/users" className={linkClass} onClick={onClick}>Users</NavLink>
          <NavLink to="/admin/billing" className={linkClass} onClick={onClick}>Billing</NavLink>
          <NavLink to="/admin/payouts" className={linkClass} onClick={onClick}>Payouts</NavLink>
          <NavLink to="/admin/payroll" className={linkClass} onClick={onClick}>Payroll</NavLink>
          <NavLink to="/admin/expenses" className={linkClass} onClick={onClick}>Expenses</NavLink>
          <NavLink to="/admin/client-balance" className={linkClass} onClick={onClick}>Client Balance</NavLink>
          <NavLink to="/admin/pnl" className={linkClass} onClick={onClick}>P&amp;L</NavLink>
        </>
      )}
      {user.role === 'call_center_admin' && (
        <>
          <NavLink to="/admin/clients" className={linkClass} onClick={onClick}>Clients</NavLink>
          <NavLink to="/admin/callers" className={linkClass} onClick={onClick}>Callers</NavLink>
          <NavLink to="/admin/payouts" className={linkClass} onClick={onClick}>Payouts</NavLink>
        </>
      )}
    </>
  );
}

export default function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isClient = user?.role === 'client';
  const { data: actionNeeded = [] } = useQuery({
    queryKey: ['action-needed'],
    queryFn: () => apiClient.getActionNeeded(),
    enabled: isClient,
  });
  const actionCount = actionNeeded.length;

  if (!user) return null;

  const handleLogout = () => { logout(); navigate('/login'); };

  const scrollToActionBanner = () => {
    navigate('/leads');
    setTimeout(() => {
      document.getElementById('action-needed-banner')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  };

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r bg-background sticky top-0 h-screen self-start">
        <div className="p-4 border-b shrink-0">
          <Link to="/" className="font-semibold tracking-tight hover:opacity-80 block text-xl">
            1Lead
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
          <NavLinks user={user} />
        </nav>

        <div className="p-3 border-t shrink-0 flex flex-col gap-2">
          {isClient && (
            <button
              type="button"
              aria-label={actionCount > 0 ? `${actionCount} leads need your action` : 'No action needed'}
              onClick={scrollToActionBanner}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm transition-colors ${
                actionCount > 0
                  ? 'border border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Bell className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">Action needed</span>
              {actionCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-0.5 text-[10px] font-bold leading-none text-white bg-amber-500 rounded-full">
                  {actionCount > 99 ? '99+' : actionCount}
                </span>
              )}
            </button>
          )}
          <div className="px-1">
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium mt-1">
              {roleLabel(user.role)}
            </span>
          </div>
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="md:hidden border-b bg-background sticky top-0 z-30 shadow-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link to="/" className="font-semibold tracking-tight hover:opacity-80 flex-1">
            lead-ops
          </Link>

          {isClient && actionCount > 0 && (
            <button
              type="button"
              aria-label={`${actionCount} leads need your action`}
              onClick={scrollToActionBanner}
              className="relative inline-flex items-center justify-center h-9 w-9 rounded-md border border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-0.5 text-[10px] font-bold leading-none text-white bg-amber-500 rounded-full">
                {actionCount > 99 ? '99+' : actionCount}
              </span>
            </button>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <Menu className="w-4 h-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 flex flex-col">
              <div className="p-4 border-b shrink-0">
                <Link
                  to="/"
                  className="font-semibold tracking-tight hover:opacity-80 block"
                  onClick={() => setMobileOpen(false)}
                >
                  lead-ops
                </Link>
              </div>
              <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
                <NavLinks user={user} onClick={() => setMobileOpen(false)} />
              </nav>
              <div className="p-3 border-t shrink-0 flex flex-col gap-2">
                <div className="text-sm font-medium truncate">{user.email}</div>
                <div className="text-xs text-muted-foreground">{roleLabel(user.role)}</div>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => { setMobileOpen(false); handleLogout(); }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
    </>
  );
}
