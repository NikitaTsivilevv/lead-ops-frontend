import React, { createContext, useContext, useState, useEffect } from "react";

const LeadOpsAuthContext = createContext(null);

export function LeadOpsAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("leadops_token");
    const savedUser = localStorage.getItem("leadops_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const signIn = (tokenValue, userData) => {
    localStorage.setItem("leadops_token", tokenValue);
    localStorage.setItem("leadops_user", JSON.stringify(userData));
    setToken(tokenValue);
    setUser(userData);
  };

  const signOut = () => {
    localStorage.removeItem("leadops_token");
    localStorage.removeItem("leadops_user");
    setToken(null);
    setUser(null);
  };

  return (
    <LeadOpsAuthContext.Provider value={{ user, token, loading, signIn, signOut }}>
      {children}
    </LeadOpsAuthContext.Provider>
  );
}

export function useLeadOpsAuth() {
  const ctx = useContext(LeadOpsAuthContext);
  if (!ctx) throw new Error("useLeadOpsAuth must be used within LeadOpsAuthProvider");
  return ctx;
}