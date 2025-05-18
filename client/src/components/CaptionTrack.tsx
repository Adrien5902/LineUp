import { useRef } from "react";
import type { Character } from "../../../shared";
import { Caption } from "./Caption";
import type { EditMode, RenderingCaptions, RenderingSubtitle } from "./Dubbing";

export function CaptionTrack({
	visibleSt,
	captions,
	character,
	editMode,
}: {
	visibleSt: RenderingSubtitle[];
	captions: React.RefObject<RenderingCaptions | null>;
	character?: Character;
	editMode: EditMode;
}) {
	const index = character
		? (captions.current?.characters?.findIndex(
				(char) => character.name === char.name,
			) ?? 0)
		: (captions.current?.characters?.length ?? 0);
	const deg = index / ((captions.current?.characters?.length ?? 0) + 1);
	const color = character?.color ?? `hsl(${deg * 360}deg, 100%, 70%)`;

	const colorInput = useRef<HTMLInputElement>(null);

	return (
		<div
			className="caption_track_container"
			character-name={character}
			onMouseEnter={() => {
				if (editMode.dragging.current)
					editMode.dragging.current.track = character?.name;
			}}
			style={{ color }}
		>
			<label className="caption_track_info">
				<input
					defaultValue={color}
					type="color"
					ref={colorInput}
					style={{ display: "none" }}
					onChange={() => {
						if (captions.current?.characters?.[index]) {
							captions.current.characters[index].color =
								colorInput.current?.value;
						}
					}}
				/>
				<span>{character?.name ?? "?"}</span>
			</label>
			<div className="caption_track">
				{visibleSt
					.filter((st) => st.character === character?.name)
					.map((st) => (
						<Caption
							editMode={editMode}
							st={st}
							key={String(character) + st.id}
						/>
					))}
			</div>
		</div>
	);
}
