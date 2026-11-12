import { ZodError } from "zod";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, type MessageMedia, type UserProfile } from "@/lib/api";
import {
	emailCodeSchema,
	passwordChangeSchema,
	profileSchema,
} from "@/schemas/profile-schema";
import {
	listMediaDevices,
	type MediaDevicePreferences,
	writeMediaDevicePreferences,
} from "@/lib/media-devices";

export function useProfileSettings({
	token,
	open,
	onUpdated,
}: {
	token: string;
	open: boolean;
	onUpdated: (user: UserProfile) => void;
}) {
	const [saving, setSaving] = useState(false);
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [code, setCode] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const avatarRef = useRef<HTMLInputElement>(null);
	const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
	const [devicePreferences, setDevicePreferences] =
		useState<MediaDevicePreferences>({
			audioInputDeviceId: null,
			audioOutputDeviceId: null,
			videoInputDeviceId: null,
		});
	useEffect(() => {
		if (!open) return;
		let active = true;
		setMessage(null);
		setProfile(null);
		void listMediaDevices()
			.then((devices) => {
				if (active) setDevices(devices);
			})
			.catch(() => {
				if (active) setDevices([]);
			});
		void api<{ user: UserProfile }>("/profile", {}, token)
			.then(({ user }) => {
				if (!active) return;
				setProfile(user);
				setDevicePreferences({
					audioInputDeviceId: user.audioInputDeviceId,
					audioOutputDeviceId: user.audioOutputDeviceId,
					videoInputDeviceId: user.videoInputDeviceId,
				});
			})
			.catch((cause: unknown) => {
				if (active)
					setMessage(
						cause instanceof Error
							? cause.message
							: "Não foi possível carregar o perfil.",
					);
			});
		return () => {
			active = false;
		};
	}, [open, token]);

	const save = async (event: FormEvent) => {
		event.preventDefault();
		if (!profile || saving) return;
		const validation = profileSchema.safeParse({
			displayName: profile.displayName,
			username: profile.username,
			countryCode: profile.countryCode,
		});
		if (!validation.success) {
			setMessage(validation.error.issues[0].message);
			return;
		}
		const input = validation.data;
		setSaving(true);
		setMessage(null);
		try {
			const result = await api<{ user: UserProfile }>(
				"/profile",
				{
					method: "PATCH",
					body: JSON.stringify({
						displayName: input.displayName,
						username: input.username,
						avatarUrl: profile.avatarUrl,
						countryCode: input.countryCode,
						audioInputDeviceId:
							devicePreferences.audioInputDeviceId,
						audioOutputDeviceId:
							devicePreferences.audioOutputDeviceId,
						videoInputDeviceId:
							devicePreferences.videoInputDeviceId,
					}),
				},
				token,
			);
			setProfile(result.user);
			writeMediaDevicePreferences(devicePreferences);
			onUpdated(result.user);
			setMessage("Perfil atualizado.");
		} catch (cause) {
			setMessage(
				cause instanceof Error
					? cause.message
					: "Não foi possível atualizar.",
			);
		} finally {
			setSaving(false);
		}
	};
	const performAction = async (action: () => Promise<void>) => {
		if (saving) return;
		setSaving(true);
		setMessage(null);
		try {
			await action();
		} catch (cause) {
			if (cause instanceof ZodError) setMessage(cause.issues[0].message);
			else
				setMessage(
					cause instanceof Error
						? cause.message
						: "Não foi possível concluir a alteração.",
				);
		} finally {
			setSaving(false);
		}
	};

	const uploadAvatar = async (file: File) => {
		const form = new FormData();
		form.append("file", file);
		const { media } = await api<{ media: MessageMedia }>(
			"/uploads",
			{ method: "POST", body: form },
			token,
		);
		setProfile((current) =>
			current ? { ...current, avatarUrl: media.url } : current,
		);
	};

	const sendCode = async () => {
		return performAction(async () => {
			await api("/profile/email-code", { method: "POST" }, token);
			setMessage("Código enviado para o seu e-mail.");
		});
	};
	const verifyEmail = async () => {
		return performAction(async () => {
			const validCode = emailCodeSchema.parse(code);
			await api(
				"/profile/verify-email",
				{ method: "POST", body: JSON.stringify({ code: validCode }) },
				token,
			);
			setMessage("E-mail confirmado.");
			const result = await api<{ user: UserProfile }>(
				"/profile",
				{},
				token,
			);
			setProfile(result.user);
			onUpdated(result.user);
			setCode("");
		});
	};
	const toggle2fa = async () => {
		return performAction(async () => {
			if (!profile) return;
			await api(
				"/profile/two-factor",
				{
					method: "POST",
					body: JSON.stringify({
						enabled: !profile.twoFactorEnabled,
					}),
				},
				token,
			);
			setProfile({
				...profile,
				twoFactorEnabled: !profile.twoFactorEnabled,
			});
		});
	};
	const changePassword = async (event: FormEvent) => {
		event.preventDefault();
		return performAction(async () => {
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
		});
	};
	return {
		saving,
		profile,
		setProfile,
		devices,
		devicePreferences,
		setDevicePreferences,
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
