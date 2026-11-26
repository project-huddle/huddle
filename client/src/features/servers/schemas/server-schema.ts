import { z } from "zod";

export const serverNameSchema = z
	.string()
	.trim()
	.min(1, "Informe o nome do servidor.")
	.max(60);

export const channelNameSchema = z
	.string()
	.trim()
	.min(1, "Informe o nome do canal.")
	.max(60);

export const inviteCodeSchema = z
	.string()
	.trim()
	.min(1, "Informe o código do convite.")
	.max(100);
