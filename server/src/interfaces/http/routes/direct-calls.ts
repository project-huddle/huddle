import { Elysia, t } from "elysia";
import {
  acceptDirectCall,
  directCalls,
  inviteDirectCall,
} from "@/app/direct-call-service";
import type { DirectCall } from "@/core/direct-calls/direct-call-registry";
import { notifyUser } from "@/interfaces/realtime/realtime-gateway";
import { closeDirectCall } from "@/interfaces/realtime/direct-call-gateway";
import { authenticatedRoutes } from "../plugins/auth";
import { error, json } from "../responses";
import { resourceId } from "../schemas";

function notifyCall(call: DirectCall, type: string) {
  const event = { type, call };
  notifyUser(call.caller.id, event);
  notifyUser(call.recipient.id, event);
}

export const directCallRoutes = new Elysia({ name: "direct-call-routes" })
  .use(authenticatedRoutes("authenticated-direct-call-routes"))
  .post(
    "/direct-calls",
    async ({ currentUser, body }) => {
      const result = await inviteDirectCall(
        currentUser,
        body.recipientId,
        crypto.randomUUID(),
        Date.now(),
      );
      if (result.type === "not-friends")
        return error(
          403,
          "NOT_FRIENDS",
          "Chamadas privadas são permitidas apenas entre amigos.",
        );
      if (result.type === "busy")
        return error(
          409,
          "CALL_BUSY",
          "Você ou seu contato já está em uma chamada privada.",
        );
      notifyCall(result.call, "direct_call_ringing");
      const timer = setTimeout(() => {
        const expired = directCalls.expire(result.call.id, Date.now());
        if (expired) notifyCall(expired, "direct_call_ended");
      }, 30_000);
      timer.unref();
      return json({ call: result.call }, 201);
    },
    { body: t.Object({ recipientId: resourceId }) },
  )
  .post(
    "/direct-calls/:callId/accept",
    async ({ currentUser, params }) => {
      const call = await acceptDirectCall(params.callId, currentUser.id);
      if (!call)
        return error(
          403,
          "INVALID_CALL",
          "A chamada não está disponível para aceitar.",
        );
      notifyCall(call, "direct_call_accepted");
      return json({ call });
    },
    { params: t.Object({ callId: resourceId }) },
  )
  .delete(
    "/direct-calls/:callId",
    ({ currentUser, params }) => {
      const call = directCalls.end(params.callId, currentUser.id);
      if (!call) return error(404, "CALL_NOT_FOUND", "Chamada não encontrada.");
      closeDirectCall(call.id);
      notifyCall(call, "direct_call_ended");
      return new Response(null, { status: 204 });
    },
    { params: t.Object({ callId: resourceId }) },
  );
