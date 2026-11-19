import type { Conversation, Prisma } from "@prisma/client";
import type { AuthPayload } from "../../middlewares/auth";
import { AppError } from "../../utils/AppError";

export type Actor = Pick<AuthPayload, "userId" | "role">;

export function assertConversationAccess(
  conversation: Pick<Conversation, "assignedToId">,
  actor: Actor,
): void {
  if (actor.role === "EMPLOYEE" && conversation.assignedToId !== actor.userId) {
    throw new AppError("Access denied to this conversation", 403);
  }
}

export function conversationScope(actor: Actor): Prisma.ConversationWhereInput {
  return actor.role === "EMPLOYEE" ? { assignedToId: actor.userId } : {};
}
