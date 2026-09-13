import { z } from "zod";

export const friendIdentifierSchema = z.string().trim().min(1, "Informe um e-mail ou link de amizade.");
export const directMessageSchema = z.string().trim().min(1).max(2000);
