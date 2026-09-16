import React, { createContext, useState, useContext, ReactNode } from 'react';

type Role = 'admin' | 'team' | null;

interface AppContextType {
  role: Role;
  teamName: string | null;
  loginAsAdmin: () => void;
  loginAsTeam: (teamName: string) => void;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<Role>(null);
  const [teamName, setTeamName] = useState<string | null>(null);

  const loginAsAdmin = () => {
    setRole('admin');
    setTeamName(null);
  };

  const loginAsTeam = (name: string) => {
    setRole('team');
    setTeamName(name);
  };

  const logout = () => {
    setRole(null);
    setTeamName(null);
  };

  return (
    <AppContext.Provider value={{ role, teamName, loginAsAdmin, loginAsTeam, logout }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
