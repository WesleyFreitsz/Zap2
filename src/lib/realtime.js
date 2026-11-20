import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import apiClient, { usersApi } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";

export function useRealtime() {
  const { isAuthenticated, isLoadingAuth, user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  useEffect(() => {
    if (!isAuthenticated || isLoadingAuth || !userId) return;

    const apiUrl = new URL(apiClient.defaults.baseURL, window.location.origin);
    let disposed = false;
    let attemptedToken;
    const typingTimers = new Map();
    const socket = io(apiUrl.origin, {
      path: `${apiUrl.pathname.replace(/\/$/, "")}/socket.io`,
      autoConnect: false,
      auth: (sendAuth) => {
        attemptedToken = localStorage.getItem("accessToken");
        sendAuth({ token: attemptedToken });
      },
    });

    const invalidateConversations = () =>
      queryClient.invalidateQueries({ queryKey: ["conversations"] });

    socket.on("message:new", ({ conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      invalidateConversations();

      if (
        !document.hidden ||
        typeof Notification === "undefined" ||
        Notification.permission !== "granted"
      ) return;

      try {
        if (localStorage.getItem("browserNotifications") !== "true") return;

        const notification = new Notification("Nova mensagem", {
          body: "Você recebeu uma nova mensagem no atendimento.",
          tag: conversationId,
        });
        notification.onclick = () => {
          window.focus();
          window.location.assign(`/conversations?contact=${encodeURIComponent(conversationId)}`);
          notification.close();
        };
      } catch {
        return;
      }
    });
    socket.on("message:updated", ({ conversationId }) =>
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] }));
    socket.on("conversation:updated", invalidateConversations);
    socket.on("conversation:typing", ({ conversationId, typing }) => {
      const key = ["typing", conversationId];
      clearTimeout(typingTimers.get(conversationId));
      typingTimers.delete(conversationId);
      queryClient.setQueryData(key, typing);
      if (typing) {
        typingTimers.set(conversationId, setTimeout(() => {
          typingTimers.delete(conversationId);
          queryClient.setQueryData(key, false);
        }, 6000));
      }
    });
    socket.on("connect", () => {
      invalidateConversations();
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    });
    socket.on("connect_error", async (error) => {
      if (socket.active || error.message !== "Invalid or expired token") return;

      try {
        if (localStorage.getItem("accessToken") === attemptedToken) {
          await usersApi.getProfile();
        }
        const currentToken = localStorage.getItem("accessToken");
        if (!disposed && currentToken && currentToken !== attemptedToken) {
          socket.connect();
        }
      } catch {
        return;
      }
    });
    socket.connect();

    return () => {
      disposed = true;
      for (const [conversationId, timer] of typingTimers) {
        clearTimeout(timer);
        queryClient.setQueryData(["typing", conversationId], false);
      }
      socket.disconnect();
    };
  }, [isAuthenticated, isLoadingAuth, queryClient, userId]);
}
