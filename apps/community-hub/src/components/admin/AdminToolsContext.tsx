import { createContext, useContext, type ReactNode } from "react";

interface AdminToolsValue {
  enabled: boolean;
  onChanged: () => void;
}

const AdminToolsContext = createContext<AdminToolsValue>({ enabled: false, onChanged: () => undefined });

export function AdminToolsProvider({ children, enabled, onChanged }: AdminToolsValue & { children: ReactNode }) {
  return <AdminToolsContext.Provider value={{ enabled, onChanged }}>{children}</AdminToolsContext.Provider>;
}

export function useAdminTools(): AdminToolsValue {
  return useContext(AdminToolsContext);
}
