import { createJoinServer } from "../features/servers/join-server/join-server";
import { createHttpApplication } from "../interfaces/http/application";
import { db } from "../shared/infrastructure/database/client";
import { createJoinServerRepository } from "../features/servers/join-server/join-server.repository";

export function createServerApplication() {
  const joinServerRepository = createJoinServerRepository(db);
  const joinServer = createJoinServer({ repository: joinServerRepository });

  return createHttpApplication({ joinServer });
}
