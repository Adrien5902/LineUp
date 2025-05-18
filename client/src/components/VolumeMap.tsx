import { useRef, useState, useEffect } from "react";
import { BlockSize, CaptionsScale, UpdateRate } from "./Dubbing";

export function VolumeMap({
	volumeMap,
	playerRef,
	sampleRate,
}: {
	volumeMap: number[];
	playerRef: React.RefObject<HTMLVideoElement | null>;
	sampleRate: number;
}) {
	const track = useRef<HTMLDivElement>(null);
	const [mapRender, setMapRender] = useState<number[]>([]);

	useEffect(() => {
		const interval = setInterval(() => {
			if (!track.current) return;
			const currentTime = playerRef.current?.currentTime ?? 0;
			const sampleTimeWidth = BlockSize / sampleRate;
			const nbVisible = window.innerWidth / (sampleTimeWidth * CaptionsScale);
			let timestamp = currentTime - nbVisible * sampleTimeWidth;
			timestamp = timestamp > 0 ? timestamp : 0;
			track.current.style.transform = `translateX(${(timestamp - currentTime) * CaptionsScale}px)`;
			setMapRender(
				volumeMap.slice(
					timestamp / sampleTimeWidth,
					(currentTime + nbVisible * sampleTimeWidth) / sampleTimeWidth,
				),
			);
		}, UpdateRate);
		return () => {
			clearInterval(interval);
		};
	}, [sampleRate, volumeMap]);

	return (
		<div id="volume_map">
			<div ref={track}>
				{mapRender.map((n, i) => (
					<div
						key={i}
						style={{
							height: `clamp(1px, ${n * 200}%,100%)`,
							width: `${(BlockSize / sampleRate) * CaptionsScale}px`,
						}}
					/>
				))}
			</div>
		</div>
	);
}
