import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import { authApi } from "@/api/apiClient";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("accessToken"),
  );
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      return;
    }

    // We have a token, try refresh to validate it
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken) {
      try {
        const data = await authApi.refresh(refreshToken);
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        setIsAuthenticated(true);
      } catch {
        // Token invalid - clear everything
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        setUser(null);
        setIsAuthenticated(false);
      }
    }
    setIsLoadingAuth(false);
  };

  const login = useCallback(async (email, password) => {
    setIsLoggingIn(true);
    try {
      const data = await authApi.login(email, password);
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
      setIsAuthenticated(true);
      return data;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const register = useCallback(async (formData) => {
    setIsLoggingIn(true);
    try {
      const data = await authApi.register(formData);
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
      setIsAuthenticated(true);
      return data;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoggingIn,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
