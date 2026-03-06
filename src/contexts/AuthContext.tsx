import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

type AppRole = "super_admin" | "hr_admin" | "employee";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  organizationId: string | null;
  organizationName: string | null;
  fullName: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  organizationId: null,
  organizationName: null,
  fullName: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch role (pick highest priority if multiple)
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (roleData && roleData.length > 0) {
        const rolePriority: AppRole[] = ["super_admin", "hr_admin", "employee"];
        const roles = roleData.map((r) => r.role as AppRole);
        const bestRole = rolePriority.find((r) => roles.includes(r)) || roles[0];
        setRole(bestRole);
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("organization_id, full_name")
        .eq("user_id", userId)
        .single();

      if (profileData) {
        setOrganizationId(profileData.organization_id);
        setFullName(profileData.full_name);

        // Fetch org name
        if (profileData.organization_id) {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("name")
            .eq("id", profileData.organization_id)
            .single();
          if (orgData) setOrganizationName(orgData.name);
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Use setTimeout to avoid Supabase auth deadlock
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setRole(null);
          setOrganizationId(null);
          setOrganizationName(null);
          setFullName(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setOrganizationId(null);
    setOrganizationName(null);
    setFullName(null);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, role, organizationId, organizationName, fullName, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};
