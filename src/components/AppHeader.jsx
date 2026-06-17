import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LogOut, Menu } from 'lucide-react';
import { roleLabel } from '@/lib/roles';
import { canUseComms } from '@/lib/commsRoles';
import NotificationBell from '@/components/NotificationBell';

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
      {canUseComms(user.role) && (
        <NavLink to="/conversations" className={linkClass} onClick={onClick}>Conversations</NavLink>
      )}
      {canUseComms(user.role) && (
        <NavLink to="/conversations/templates" className={({ isActive }) => `${linkClass({ isActive })} ml-3 text-xs`} onClick={onClick}>SMS Templates</NavLink>
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

  if (!user) return null;

  const handleLogout = () => { logout(); navigate('/login'); };

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
          <div className="flex items-center justify-between gap-2">
            <div className="px-1 min-w-0">
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium mt-1">
                {roleLabel(user.role)}
              </span>
            </div>
            <NotificationBell />
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
            1Lead
          </Link>

          <NotificationBell />

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
                  1Lead
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
