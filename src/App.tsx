import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import CotacaoResposta from "./pages/CotacaoResposta.tsx";
import OAuthCallback from "./pages/OAuthCallback.tsx";
import OAuthInitiate from "./pages/OAuthInitiate.tsx";
import OAuthConsent from "./pages/OAuthConsent.tsx";
import Perfil from "./pages/Perfil.tsx";
import AdminPanel from "./pages/AdminPanel.tsx";
import MasterAdmin from "./pages/MasterAdmin.tsx";
import MasterLogin from "./pages/MasterLogin.tsx";
import MasterAuditLogs from "./pages/MasterAuditLogs.tsx";

import NetworkAdmin from "./pages/NetworkAdmin.tsx";
import NetworkRouter from "./pages/NetworkRouter.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/~oauth/initiate" element={<OAuthInitiate />} />
            <Route path="/auth/callback" element={<OAuthCallback />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="/cotacao/:token" element={<CotacaoResposta />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/perfil"
              element={
                <ProtectedRoute>
                  <Perfil />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPanel />
                </ProtectedRoute>
              }
            />
            <Route path="/master/login" element={<MasterLogin />} />
            <Route
              path="/master"
              element={
                <ProtectedRoute>
                  <MasterAdmin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/master/logs"
              element={
                <ProtectedRoute>
                  <MasterAuditLogs />
                </ProtectedRoute>
              }
            />


            <Route
              path="/master/network/:networkId"
              element={
                <ProtectedRoute>
                  <NetworkAdmin />
                </ProtectedRoute>
              }
            />
            {/* Rotas dinâmicas por slug de rede */}
            <Route path="/n/:slug" element={<NetworkRouter />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
