import { Toaster } from "sonner";

import { QueryClientProvider } from "@tanstack/react-query";

import { queryClientInstance } from "@/lib/query-client";

import {

  BrowserRouter as Router,

  Route,

  Routes,

  Navigate,

} from "react-router-dom";

import PageNotFound from "./lib/PageNotFound";

import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { useRealtime } from "@/lib/realtime";

import { ThemeProvider } from "@/lib/ThemeContext";

import AppLayout from "./components/layout/AppLayout";

import Dashboard from "./pages/Dashboard";

import Conversations from "./pages/Conversations";

import AIConfig from "./pages/AIConfig";

import Channels from "./pages/Channels";

import Analytics from "./pages/Analytics";

import Settings from "./pages/Settings";

import Schedule from "./pages/Schedule";

import Employees from "./pages/Employees";

import Products from "./pages/Products";

import Login from "./pages/Login";

import LandingPage from "./pages/LandingPage";

import Leads from "./pages/Leads";

import AdminDashboard from "./pages/AdminDashboard";

import Billing from "./pages/Billing";

import AcceptInvite from "./pages/AcceptInvite";

import AdminPlans from "./pages/AdminPlans";

import AdminBilling from "./pages/AdminBilling";

import ContactTagsManager from "./components/schedule/ContactTagsManager";



const LoadingSpinner = () => (

  <div className="fixed inset-0 flex items-center justify-center">

    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>

  </div>

);



const ProtectedRoute = ({ children }) => {

  const { isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) return <LoadingSpinner />;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return children;

};



const PublicRoute = ({ children }) => {

  const { isAuthenticated, isLoadingAuth, user } = useAuth();

  if (isLoadingAuth) return <LoadingSpinner />;

  if (isAuthenticated) {

    const dest =

      user?.role === "SUPER_ADMIN" ? "/admin-dashboard" : "/dashboard";

    return <Navigate to={dest} replace />;

  }

  return children;

};



// Route guard: only allowed roles can access

const RoleRoute = ({ children, allowed }) => {

  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;



  const effectiveRole =

    user.role === "EMPLOYEE" && user.isTeamLeader ? "TEAM_LEADER" : user.role;



  if (allowed && !allowed.includes(effectiveRole)) {

    if (user.role === "SUPER_ADMIN")

      return <Navigate to="/admin-dashboard" replace />;

    if (effectiveRole === "EMPLOYEE")

      return <Navigate to="/conversations" replace />;

    return <Navigate to="/dashboard" replace />;

  }

  return children;

};



function Realtime() {
  useRealtime();
  return null;
}

function App() {

  return (

    <ThemeProvider>

      <AuthProvider>

        <QueryClientProvider client={queryClientInstance}>
          <Realtime />

          <Router>

            <Routes>

              <Route path="/" element={<LandingPage />} />

              <Route

                path="/login"

                element={

                  <PublicRoute>

                    <Login />

                  </PublicRoute>

                }

              />

              <Route path="/invite/:token" element={<AcceptInvite />} />

              <Route

                element={

                  <ProtectedRoute>

                    <AppLayout />

                  </ProtectedRoute>

                }

              >

                {/* SUPER_ADMIN only */}

                <Route

                  path="/admin-dashboard"

                  element={

                    <RoleRoute allowed={["SUPER_ADMIN"]}>

                      <AdminDashboard />

                    </RoleRoute>

                  }

                />

                <Route

                  path="/admin/plans"

                  element={

                    <RoleRoute allowed={["SUPER_ADMIN"]}>

                      <AdminPlans />

                    </RoleRoute>

                  }

                />

                <Route

                  path="/admin/billing"

                  element={

                    <RoleRoute allowed={["SUPER_ADMIN"]}>

                      <AdminBilling />

                    </RoleRoute>

                  }

                />



                {/* ADMIN only */}

                <Route

                  path="/dashboard"

                  element={

                    <RoleRoute allowed={["ADMIN"]}>

                      <Dashboard />

                    </RoleRoute>

                  }

                />

                <Route

                  path="/ai-config"

                  element={

                    <RoleRoute allowed={["ADMIN"]}>

                      <AIConfig />

                    </RoleRoute>

                  }

                />

                <Route

                  path="/channels"

                  element={

                    <RoleRoute allowed={["ADMIN"]}>

                      <Channels />

                    </RoleRoute>

                  }

                />

                <Route

                  path="/whatsapp"
                  element={<Navigate to="/channels" replace />}
                />
                <Route
                  path="/employees"

                  element={

                    <RoleRoute allowed={["ADMIN"]}>

                      <Employees />

                    </RoleRoute>

                  }

                />

                <Route

                  path="/billing"

                  element={

                    <RoleRoute allowed={["ADMIN"]}>

                      <Billing />

                    </RoleRoute>

                  }

                />



                {/* ADMIN + TEAM_LEADER */}

                <Route

                  path="/analytics"

                  element={

                    <RoleRoute allowed={["ADMIN", "TEAM_LEADER"]}>

                      <Analytics />

                    </RoleRoute>

                  }

                />



                {/* ADMIN + EMPLOYEE (TEAM_LEADER inherits EMPLOYEE) */}

                <Route

                  path="/conversations"

                  element={

                    <RoleRoute allowed={["ADMIN", "EMPLOYEE", "TEAM_LEADER"]}>

                      <Conversations />

                    </RoleRoute>

                  }

                />

                <Route

                  path="/leads"

                  element={

                    <RoleRoute allowed={["ADMIN", "EMPLOYEE", "TEAM_LEADER"]}>

                      <Leads />

                    </RoleRoute>

                  }

                />

                <Route

                  path="/schedule"

                  element={

                    <RoleRoute allowed={["ADMIN", "EMPLOYEE", "TEAM_LEADER"]}>

                      <Schedule />

                    </RoleRoute>

                  }

                />

                <Route

                  path="/tags"

                  element={

                    <RoleRoute allowed={["ADMIN"]}>

                      <ContactTagsManager />

                    </RoleRoute>

                  }

                />

                <Route

                  path="/products"

                  element={

                    <RoleRoute allowed={["ADMIN", "EMPLOYEE", "TEAM_LEADER"]}>

                      <Products />

                    </RoleRoute>

                  }

                />



                {/* All authenticated */}

                <Route path="/settings" element={<Settings />} />

              </Route>

              <Route path="*" element={<PageNotFound />} />

            </Routes>

          </Router>

          <Toaster richColors position="top-right" />

        </QueryClientProvider>

      </AuthProvider>

    </ThemeProvider>

  );

}



export default App;

