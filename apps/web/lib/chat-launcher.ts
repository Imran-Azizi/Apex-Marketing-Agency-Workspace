/** Global opener for the floating chat drawer (single entry point for internal chat). */

export type ChatOpenListener = (conversationId: string | null) => void;

const listeners = new Set<ChatOpenListener>();

export function subscribeChatOpen(listener: ChatOpenListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openChatDrawer(conversationId?: string | null) {
  for (const listener of listeners) {
    listener(conversationId ?? null);
  }
}
