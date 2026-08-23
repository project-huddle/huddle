export type MessageHistoryRepository = {
  listMessageHistory(
    channelId: string,
    limit: number,
    before?: string,
  ): Promise<unknown[]>;
};
