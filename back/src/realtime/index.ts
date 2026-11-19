import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { env } from "../config/env";
import type { AuthPayload } from "../middlewares/auth";

type ConversationAudience = {
  id: string;
  companyId: string;
  assignedToId: string | null;
};

interface ServerEvents {
  "message:new": (event: { conversationId: string }) => void;
  "message:updated": (event: { conversationId: string }) => void;
  "conversation:updated": (event: { conversationId: string }) => void;
}

let realtime: Server<Record<string, never>, ServerEvents> | undefined;

export function initRealtime(httpServer: HttpServer) {
  const io = new Server<Record<string, never>, ServerEvents>(httpServer, {
    path: "/api/socket.io",
    cors: { origin: env.FRONTEND_ORIGINS },
    allowRequest: ({ headers: { origin } }, callback) => {
      callback(null, !origin || env.FRONTEND_ORIGINS.includes(origin));
    },
  });

  io.use((socket, next) => {
    const token: unknown = socket.handshake.auth.token;
    if (typeof token !== "string" || !token) {
      return next(new Error("Invalid or expired token"));
    }

    let user: Partial<AuthPayload>;
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      if (typeof payload === "string") {
        return next(new Error("Invalid or expired token"));
      }
      user = payload as Partial<AuthPayload>;
    } catch {
      return next(new Error("Invalid or expired token"));
    }

    const { userId, companyId, role } = user;
    if (
      typeof userId !== "string" || !userId ||
      typeof companyId !== "string" || !companyId
    ) {
      return next(new Error("User and company required"));
    }

    const rooms = [`user:${userId}`];
    if (role === "ADMIN" || role === "SUPER_ADMIN") {
      rooms.push(`company:${companyId}:staff`);
    }
    socket.join(rooms);
    next();
  });

  realtime = io;
  return io;
}

function emitToConversation(
  event: keyof ServerEvents,
  { id, companyId, assignedToId }: ConversationAudience,
  previousAssigneeId?: string | null,
) {
  const rooms = [`company:${companyId}:staff`];
  if (assignedToId) rooms.push(`user:${assignedToId}`);
  if (previousAssigneeId && previousAssigneeId !== assignedToId) {
    rooms.push(`user:${previousAssigneeId}`);
  }
  realtime?.to(rooms).emit(event, { conversationId: id });
}

export function emitMessageCreated(conversation: ConversationAudience) {
  emitToConversation("message:new", conversation);
}

export function emitMessageUpdated(conversation: ConversationAudience) {
  emitToConversation("message:updated", conversation);
}

export function emitConversationUpdated(
  conversation: ConversationAudience,
  previousAssigneeId?: string | null,
) {
  emitToConversation("conversation:updated", conversation, previousAssigneeId);
}
