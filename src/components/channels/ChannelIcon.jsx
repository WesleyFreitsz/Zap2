import { Facebook, Instagram, MessageCircle } from "lucide-react";

export const channelLabels = {
  WHATSAPP: "WhatsApp",
  FACEBOOK: "Facebook Messenger",
  INSTAGRAM: "Instagram",
};

const channelIcons = {
  WHATSAPP: MessageCircle,
  FACEBOOK: Facebook,
  INSTAGRAM: Instagram,
};

export function isSocialConversation({ channel }) {
  return channel === "FACEBOOK" || channel === "INSTAGRAM";
}

export function getConversationPhone(conversation) {
  if (isSocialConversation(conversation)) return null;
  return conversation.displayPhone || conversation.contactPhone;
}

export function getConversationName(conversation) {
  const { displayName, displayPhone, contactPhone, contactRemoteId } = conversation;
  if (isSocialConversation(conversation) &&
      (!displayName || [displayPhone, contactPhone, contactRemoteId].includes(displayName))) {
    return "Contato sem nome";
  }
  return displayName;
}

export default function ChannelIcon({ type = "WHATSAPP", ...props }) {
  const Icon = channelIcons[type] || MessageCircle;
  return <Icon role="img" aria-label={channelLabels[type] || "Canal"} {...props} />;
}
