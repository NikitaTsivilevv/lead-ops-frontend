import React from "react";
import { useAuth } from "@/lib/LeadOpsAuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background font-inter flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome, {user?.name || user?.email || "User"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Role: <span className="font-medium text-foreground">{user?.role || "—"}</span>
        </p>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          More features coming soon — Caller intake, List view, Confirmation, Calendar, Pipeline, and Admin payout.
        </p>
        <Button variant="outline" onClick={handleLogout} className="mt-4 gap-2">
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}