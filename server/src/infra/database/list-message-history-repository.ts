import type { MessageHistoryRepository } from "../../features/messages/list-message-history/list-message-history.port";
import { messageHistory } from "./message-repository";

export function createListMessageHistoryRepository(): MessageHistoryRepository {
  return { listMessageHistory: messageHistory };
}
