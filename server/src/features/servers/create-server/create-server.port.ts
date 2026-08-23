export type CreatedServer = {
  server: {
    id: string;
    name: string;
    ownerId: string;
    createdAt: string;
  };
  channel: {
    id: string;
    serverId: string;
    name: string;
    type: "text";
  };
};

export type CreateServerRepository = {
  createServer(ownerId: string, name: string): Promise<CreatedServer>;
};
