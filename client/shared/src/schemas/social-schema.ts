import { z } from "zod";

export const friendEmailSchema = z.string().trim().email("Informe um e-mail válido.");
export const directMessageSchema = z.string().trim().min(1).max(2000);
