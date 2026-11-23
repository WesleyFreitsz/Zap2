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
  "conversation:typing": (event: { conversationId: string; typing: boolean }) => void;
  "lead:updated": (event: { leadId: string }) => void;
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

function conversationRooms(
  { companyId, assignedToId }: ConversationAudience,
  previousAssigneeId?: string | null,
) {
  const rooms = [`company:${companyId}:staff`];
  if (assignedToId) rooms.push(`user:${assignedToId}`);
  if (previousAssigneeId && previousAssigneeId !== assignedToId) {
    rooms.push(`user:${previousAssigneeId}`);
  }
  return rooms;
}

function emitToConversation(
  event: "message:new" | "message:updated" | "conversation:updated",
  conversation: ConversationAudience,
  previousAssigneeId?: string | null,
) {
  realtime?.to(conversationRooms(conversation, previousAssigneeId)).emit(event, { conversationId: conversation.id });
}

export function emitConversationTyping(conversation: ConversationAudience, typing: boolean) {
  realtime?.to(conversationRooms(conversation)).emit("conversation:typing", { conversationId: conversation.id, typing });
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

export function emitLeadUpdated(companyId: string, leadId: string, userIds: Array<string | null>) {
  const rooms = [`company:${companyId}:staff`, ...new Set(userIds.filter(Boolean).map((id) => `user:${id}`))];
  realtime?.to(rooms).emit("lead:updated", { leadId });
}
