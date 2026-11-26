import { z } from "zod";

export const loginSchema = z.object({
	email: z
		.string()
		.min(1, "Informe seu e-mail")
		.email("Digite um e-mail válido"),
	password: z
		.string()
		.min(1, "Informe sua senha")
		.min(8, "A senha deve ter pelo menos 8 caracteres"),
	remember: z.boolean(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
