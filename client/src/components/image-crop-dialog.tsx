import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { cropGeometry, cropImage } from "@/lib/image-crop";

type Props = {
	file: File | null;
	onClose: () => void;
	onConfirm: (file: File) => Promise<void>;
	round?: boolean;
};

export function ImageCropDialog({
	file,
	onClose,
	onConfirm,
	round = false,
}: Props) {
	const [source, setSource] = useState("");
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
	const [zoom, setZoom] = useState(1);
	const [horizontal, setHorizontal] = useState(0);
	const [vertical, setVertical] = useState(0);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const image = useRef<HTMLImageElement>(null);
	const drag = useRef<{
		x: number;
		y: number;
		horizontal: number;
		vertical: number;
	} | null>(null);
	useEffect(() => {
		setZoom(1);
		setHorizontal(0);
		setVertical(0);
		setDimensions({ width: 0, height: 0 });
		setError(null);
		if (!file) {
			setSource("");
			return;
		}
		if (
			!["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
			file.size > 8 * 1024 * 1024
		) {
			setError("Escolha uma imagem PNG, JPEG ou WebP de até 8 MB.");
			setSource("");
			return;
		}
		const url = URL.createObjectURL(file);
		setSource(url);
		return () => URL.revokeObjectURL(url);
	}, [file]);
	const crop = dimensions.width
		? cropGeometry(
				dimensions.width,
				dimensions.height,
				zoom,
				horizontal,
				vertical,
			)
		: null;
	const move = (event: PointerEvent<HTMLDivElement>) => {
		if (!drag.current || !crop) return;
		const width = event.currentTarget.getBoundingClientRect().width;
		const xRange = ((dimensions.width / crop.size - 1) * width) / 2;
		const yRange = ((dimensions.height / crop.size - 1) * width) / 2;
		const clamp = (value: number) => Math.max(-1, Math.min(1, value));
		if (xRange > 0)
			setHorizontal(
				clamp(
					drag.current.horizontal +
						(event.clientX - drag.current.x) / xRange,
				),
			);
		if (yRange > 0)
			setVertical(
				clamp(
					drag.current.vertical +
						(event.clientY - drag.current.y) / yRange,
				),
			);
	};
	const confirm = async () => {
		if (!image.current || !crop || saving) return;
		setSaving(true);
		setError(null);
		try {
			const cropped = await cropImage(
				image.current,
				zoom,
				horizontal,
				vertical,
			);
			await onConfirm(cropped);
			onClose();
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "Não foi possível preparar a imagem.",
			);
		} finally {
			setSaving(false);
		}
	};
	return (
		<Modal
			open={Boolean(file)}
			onClose={onClose}
			title="Ajustar imagem"
			description="Arraste para posicionar e ajuste o zoom antes de usar a imagem."
		>
			{error && (
				<p role="alert" className="mb-3 text-sm text-red-600">
					{error}
				</p>
			)}
			{source && (
				<div className="space-y-4">
					<div
						className={`relative mx-auto aspect-square w-full max-w-72 touch-none cursor-grab overflow-hidden bg-(--solid) ${round ? "rounded-full" : "rounded-2xl"}`}
						aria-label="Pré-visualização da imagem"
						onPointerDown={(event) => {
							event.currentTarget.setPointerCapture(
								event.pointerId,
							);
							drag.current = {
								x: event.clientX,
								y: event.clientY,
								horizontal,
								vertical,
							};
						}}
						onPointerMove={move}
						onPointerUp={() => {
							drag.current = null;
						}}
						onPointerCancel={() => {
							drag.current = null;
						}}
					>
						<img
							ref={image}
							src={source}
							alt="Prévia do recorte"
							draggable={false}
							onLoad={(event) =>
								setDimensions({
									width: event.currentTarget.naturalWidth,
									height: event.currentTarget.naturalHeight,
								})
							}
							onError={() =>
								setError("Não foi possível abrir essa imagem.")
							}
							className="pointer-events-none absolute max-w-none select-none"
							style={
								crop
									? {
											width: `${(dimensions.width / crop.size) * 100}%`,
											height: `${(dimensions.height / crop.size) * 100}%`,
											left: `${(-crop.x / crop.size) * 100}%`,
											top: `${(-crop.y / crop.size) * 100}%`,
										}
									: { width: "100%" }
							}
						/>
					</div>
					<label className="block text-sm font-bold">
						Zoom
						<input
							aria-label="Zoom da imagem"
							type="range"
							min="1"
							max="3"
							step="0.05"
							value={zoom}
							onChange={(event) =>
								setZoom(Number(event.target.value))
							}
							className="mt-2 block w-full"
						/>
					</label>
					<label className="block text-sm">
						Posição horizontal
						<input
							aria-label="Posição horizontal"
							type="range"
							min="-1"
							max="1"
							step="0.01"
							value={horizontal}
							onChange={(event) =>
								setHorizontal(Number(event.target.value))
							}
							className="block w-full"
						/>
					</label>
					<label className="block text-sm">
						Posição vertical
						<input
							aria-label="Posição vertical"
							type="range"
							min="-1"
							max="1"
							step="0.01"
							value={vertical}
							onChange={(event) =>
								setVertical(Number(event.target.value))
							}
							className="block w-full"
						/>
					</label>
				</div>
			)}
			<div className="mt-5 flex justify-end gap-2">
				<button
					type="button"
					onClick={onClose}
					className="rounded-xl border border-(--line) px-4 py-2 text-sm font-bold"
				>
					Cancelar
				</button>
				<button
					type="button"
					disabled={!crop || saving}
					onClick={() => void confirm()}
					className="rounded-xl bg-(--brand) px-4 py-2 text-sm font-bold disabled:opacity-50"
				>
					{saving ? "Preparando..." : "Usar imagem"}
				</button>
			</div>
		</Modal>
	);
}
