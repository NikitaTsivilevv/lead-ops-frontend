import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/LeadOpsAuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LogOut, Menu } from 'lucide-react';
import { roleLabel } from '@/lib/roles';
import NotificationBell from '@/components/NotificationBell';

function NavLinks({ user, onClick }) {
  const linkClass = ({ isActive }) =>
    `block px-3 py-2 rounded-md text-sm transition-colors ${
      isActive
        ? 'text-foreground font-medium bg-muted'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
    }`;

  return (
    <>
      {!['caller','qa'].includes(user.role) && (
        <NavLink to="/pipeline" className={linkClass} onClick={onClick}>Pipeline</NavLink>
      )}
      {!['caller','qa'].includes(user.role) && (
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
      {['caller','confirmation'].includes(user.role) && (
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

  return (
    <header className="border-b bg-background sticky top-0 z-30 bg-white shadow-md">
      <div className="max-w-full mx-auto px-4 py-3 flex items-center gap-3">
        <Link to="/" className="font-semibold tracking-tight hover:opacity-80 shrink-0">
          lead-ops
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex flex-wrap justify-center items-center gap-0.5 ml-2 flex-1">
          <NavLinks user={user} />
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          <NotificationBell />
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden lg:inline truncate max-w-[180px]">{user.email}</span>
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium shrink-0">
              {roleLabel(user.role)}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:flex"
            onClick={() => { logout(); navigate('/login'); }}
          >
            <LogOut className="w-4 h-4 mr-1" />
            Sign out
          </Button>

          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden h-9 w-9">
                <Menu className="w-4 h-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 p-0 flex flex-col">
              <div className="p-4 border-b shrink-0">
                <div className="text-sm font-medium truncate">{user.email}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {roleLabel(user.role)}
                </div>
              </div>
              <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
                <NavLinks user={user} onClick={() => setMobileOpen(false)} />
              </nav>
              <div className="p-3 border-t shrink-0">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => { setMobileOpen(false); logout(); navigate('/login'); }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
