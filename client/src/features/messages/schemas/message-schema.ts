import { z } from "zod";

export const gifQuerySchema = z
	.string()
	.trim()
	.min(1, "Informe o que deseja buscar.")
	.max(50);

export const messageDraftSchema = z.string().trim().max(2000);

export const imageUploadSchema = z.instanceof(File).refine(
	(file) =>
		["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
			file.type,
		),
	"Formato de imagem não suportado.",
);
