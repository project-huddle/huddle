import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, type MessageMedia, type UserProfile } from "@/lib/api";
import {
	emailCodeSchema,
	passwordChangeSchema,
	profileSchema,
} from "@/schemas/profile-schema";

export function useProfileSettings({
	token,
	open,
	onUpdated,
}: {
	token: string;
	open: boolean;
	onUpdated: (user: UserProfile) => void;
}) {
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [code, setCode] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const avatarRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (open)
			void api<{ user: UserProfile }>("/profile", {}, token).then(
				({ user }) => setProfile(user),
			);
	}, [open, token]);
	const save = async (event: FormEvent) => {
		event.preventDefault();
		if (!profile) return;
		const input = profileSchema.parse({
			displayName: profile.displayName,
			countryCode: profile.countryCode,
		});
		try {
			const result = await api<{ user: UserProfile }>(
				"/profile",
				{
					method: "PATCH",
					body: JSON.stringify({
						displayName: input.displayName,
						avatarUrl: profile.avatarUrl,
						countryCode: input.countryCode,
					}),
				},
				token,
			);
			setProfile(result.user);
			onUpdated(result.user);
			setMessage("Perfil atualizado.");
		} catch (cause) {
			setMessage(
				cause instanceof Error
					? cause.message
					: "Não foi possível atualizar.",
			);
		}
	};
	const uploadAvatar = async (file?: File) => {
		if (!file) return;
		const form = new FormData();
		form.append("file", file);
		const { media } = await api<{ media: MessageMedia }>(
			"/uploads",
			{ method: "POST", body: form },
			token,
		);
		setProfile((value) =>
			value ? { ...value, avatarUrl: media.url } : value,
		);
	};
	const sendCode = async () => {
		await api("/profile/email-code", { method: "POST" }, token);
		setMessage("Código enviado para o seu e-mail.");
	};
	const verifyEmail = async () => {
		const validCode = emailCodeSchema.parse(code);
		await api(
			"/profile/verify-email",
			{ method: "POST", body: JSON.stringify({ code: validCode }) },
			token,
		);
		setMessage("E-mail confirmado.");
		setCode("");
	};
	const toggle2fa = async () => {
		if (!profile) return;
		await api(
			"/profile/two-factor",
			{
				method: "POST",
				body: JSON.stringify({ enabled: !profile.twoFactorEnabled }),
			},
			token,
		);
		setProfile({ ...profile, twoFactorEnabled: !profile.twoFactorEnabled });
	};
	const changePassword = async (event: FormEvent) => {
		event.preventDefault();
		const passwords = passwordChangeSchema.parse({
			currentPassword,
			newPassword,
		});
		await api(
			"/profile/password",
			{
				method: "POST",
				body: JSON.stringify(passwords),
			},
			token,
		);
		setCurrentPassword("");
		setNewPassword("");
		setMessage("Senha alterada. Entre novamente com a nova senha.");
	};
	return {
		profile,
		setProfile,
		code,
		setCode,
		message,
		currentPassword,
		setCurrentPassword,
		newPassword,
		setNewPassword,
		avatarRef,
		save,
		uploadAvatar,
		sendCode,
		verifyEmail,
		toggle2fa,
		changePassword,
	};
}
