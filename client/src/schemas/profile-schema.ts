import { z } from "zod";

export const profileSchema = z.object({
	displayName: z.string().trim().min(2).max(60),
	countryCode: z.string().length(2).nullable(),
	cpf: z.string().trim().optional(),
	birthDate: z.string().optional(),
});

export const emailCodeSchema = z.string().regex(/^\d{6}$/, "Informe os seis dígitos.");
export const passwordChangeSchema = z.object({
	currentPassword: z.string().min(8),
	newPassword: z.string().min(8),
});
