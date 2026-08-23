export type ListedServer = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
};

export type ListServersRepository = {
  listServers(userId: string): Promise<ListedServer[]>;
};
