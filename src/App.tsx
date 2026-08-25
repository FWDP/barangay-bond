import React from "react";
import { BrowserRouter } from "react-router-dom";
import { LoadingProvider } from "./contexts/LoadingContext";
import { UniversalLoadingOverlay } from "./components/UniversalLoadingOverlay";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { WalletProvider } from "./contexts/WalletContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DevConsole } from "./components/DevConsole";
import { AppRoutes } from "./routes/AppRoutes";

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LoadingProvider>
          <AuthProvider>
            <WalletProvider>
              <BrowserRouter>
                <AppRoutes />
                <UniversalLoadingOverlay />
                <DevConsole />
              </BrowserRouter>
            </WalletProvider>
          </AuthProvider>
        </LoadingProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
