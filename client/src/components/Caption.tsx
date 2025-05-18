import { useEffect, useState } from "react";
import {
	CaptionsScale,
	type RenderingSubtitle,
	type EditMode,
} from "./Dubbing";

export function Caption({
	st,
	editMode,
}: { st: RenderingSubtitle; editMode: EditMode }) {
	const duration = st.end - st.start;

	const [selected, setSelected] = useState(false);
	useEffect(() => {
		setSelected(editMode.selectedCaption.current === st.id);
	}, [editMode.selectedCaption.current]);

	return (
		<div
			className="caption"
			onMouseDown={(e) => {
				editMode.selectedCaption.current = st.id;
				if (
					editMode.active &&
					!(
						"classList" in e.target &&
						(e.target as HTMLElement).classList.contains("caption_side_crop")
					)
				) {
					editMode.dragging.current = {
						mode: "caption-edit",
						mouse: e.clientX,
						time: st.start,
						track: st.character,
						origin: { start: st.start, end: st.end },
						originalCharacter: st.character,
					};
				}
			}}
			st-id={st.id}
			key={st.id}
			style={{
				zIndex: selected ? 5 : 4,
				borderStyle: selected && editMode.active ? "solid" : "none",
				width: `${duration * CaptionsScale}px`,
			}}
		>
			{editMode.active ? (
				<div
					className="caption_side_crop left"
					onMouseDown={(e) => {
						editMode.dragging.current = {
							mode: "caption-crop-left",
							mouse: e.clientX,
							track: st.character,
							time: st.start,
							origin: { start: st.start, end: st.end },
							originalCharacter: st.character,
						};
					}}
				/>
			) : null}
			<div className="caption_text" style={{ opacity: 0.6 }}>
				{st.text}
			</div>
			<div className="caption_overlap" style={{ maxWidth: 0 }}>
				<div
					className="caption_text"
					style={{
						width: `${duration * CaptionsScale}px`,
					}}
				>
					{st.text}
				</div>
			</div>
			{editMode.active ? (
				<div
					className="caption_side_crop right"
					onMouseDown={(e) => {
						editMode.dragging.current = {
							mode: "caption-crop-right",
							mouse: e.clientX,
							track: st.character,
							time: st.end,
							originalCharacter: st.character,
						};
					}}
				/>
			) : null}
		</div>
	);
}
