import { authorizedDirectCall, directCalls } from "@/features/calls/application/direct-call-service";
import { DirectCallGateway } from "./direct-call-connections";

const gateway = new DirectCallGateway({
  authorize: authorizedDirectCall,
  isActive: (call) =>
    directCalls.forParticipant(call.id, call.caller.id, Date.now()) === call,
  end: (callId, userId) => directCalls.end(callId, userId),
  schedule: (callback, delay) => Number(setTimeout(callback, delay)),
  cancel: (timer) => clearTimeout(timer),
});

export const closeDirectCall = gateway.close.bind(gateway);
export const disconnectDirectCall = gateway.disconnect.bind(gateway);
export const handleDirectCallEvent = gateway.handle.bind(gateway);
