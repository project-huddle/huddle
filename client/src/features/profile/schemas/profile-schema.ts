import { z } from "zod";

export const profileSchema = z.object({
	username: z
		.string()
		.trim()
		.toLowerCase()
		.transform((value) => value.replace(/^@/, ""))
		.pipe(
			z
				.string()
				.regex(
					/^[a-z0-9_]{3,40}$/,
					"Use de 3 a 40 letras, números ou sublinhados.",
				),
		),
	displayName: z
		.string()
		.trim()
		.min(2, "O nome deve ter entre 2 e 32 caracteres.")
		.max(32, "O nome deve ter entre 2 e 32 caracteres."),
	countryCode: z.string().length(2).nullable(),
});

export const emailCodeSchema = z
	.string()
	.regex(/^\d{6}$/, "Informe os seis dígitos.");
export const passwordChangeSchema = z.object({
	currentPassword: z.string().min(8),
	newPassword: z.string().min(8),
});
