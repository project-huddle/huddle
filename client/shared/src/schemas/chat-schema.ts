import { z } from "zod";

export const serverNameSchema = z.string().trim().min(1, "Informe o nome do servidor.").max(60);
export const channelNameSchema = z.string().trim().min(1, "Informe o nome do canal.").max(60);
export const inviteCodeSchema = z.string().trim().min(1, "Informe o código do convite.").max(100);
export const gifQuerySchema = z.string().trim().min(1, "Informe o que deseja buscar.").max(100);
export const messageDraftSchema = z.string().trim().max(2000);
export const imageUploadSchema = z.instanceof(File).refine(
	(file) => ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type),
	"Formato de imagem não suportado.",
);
