export function cropGeometry(
	width: number,
	height: number,
	zoom: number,
	horizontal: number,
	vertical: number,
) {
	const size = Math.min(width, height) / zoom;
	return {
		size,
		x: ((width - size) * (1 - horizontal)) / 2,
		y: ((height - size) * (1 - vertical)) / 2,
	};
}

export function cropImage(
	image: HTMLImageElement,
	zoom: number,
	horizontal: number,
	vertical: number,
): Promise<File> {
	const crop = cropGeometry(
		image.naturalWidth,
		image.naturalHeight,
		zoom,
		horizontal,
		vertical,
	);
	const canvas = document.createElement("canvas");
	canvas.width = 512;
	canvas.height = 512;
	const context = canvas.getContext("2d");
	if (!context)
		return Promise.reject(new Error("Não foi possível preparar a imagem."));
	context.drawImage(
		image,
		crop.x,
		crop.y,
		crop.size,
		crop.size,
		0,
		0,
		512,
		512,
	);
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (!blob) {
					reject(new Error("Não foi possível recortar a imagem."));
					return;
				}
				resolve(
					new File([blob], "imagem-recortada.webp", {
						type: "image/webp",
					}),
				);
			},
			"image/webp",
			0.9,
		);
	});
}
