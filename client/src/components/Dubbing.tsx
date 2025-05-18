import { useEffect, useRef, useState } from "react";
import {
	faBackwardStep,
	faForwardStep,
	faMicrophoneLines,
	faMicrophoneLinesSlash,
	faPause,
	faPencil,
	faPlay,
	faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { CaptionTrack } from "./CaptionTrack";
import { Button } from "./Button";
import BackArrow from "./BackArrow";
import type { Captions, Subtitle } from "../../../shared";
import { useSocket } from "./SocketProvider";
import { baseUrl, useSdk } from "./SdkProvider";
import { smartSplit } from "../types";

export const CaptionsScale = 300;
export const BlockSize = 1024;
export const UpdateRate = 10;
export const SnapDiff = 0.05;

export type RenderingSubtitle = { id: number } & Subtitle;
export type RenderingCaptions = { captions: RenderingSubtitle[] } & Captions;

export interface DraggingState {
	track?: string;
	time: number;
	mouse: number;
	mode:
		| "scroll"
		| "captions-scroll"
		| "caption-edit"
		| "caption-crop-left"
		| "caption-crop-right";
	originalCharacter?: string;
	origin?: { start: number; end: number };
}

function paddingZero(n: number): string {
	return n < 10 ? `0${n}` : n.toString();
}

function displayTime(seconds: number): string {
	const date = new Date(seconds * 1000);
	const hours = date.getHours() - 1;
	return `${hours > 0 ? `${hours}:` : ""}${paddingZero(date.getMinutes())}:${paddingZero(date.getSeconds())},${date.getMilliseconds()}`;
}

export interface EditMode {
	active: boolean;
	dragging: React.RefObject<DraggingState | null>;
	selectedCaption: React.RefObject<number | null>;
}

type ActionType = "delete" | "add" | "edit";

interface Props {
	episode: string | null;
	setEpisode: (e: string | null) => void;
	room: string | null;
}

export default function Dubbing({ episode, setEpisode, room }: Props) {
	const socket = useSocket();
	const sdk = useSdk();

	const playerRef = useRef<HTMLVideoElement>(null);
	const subtitlesParent = useRef<HTMLDivElement>(null);
	const currentAudio = useRef<HTMLAudioElement>(null);
	const vocalsAudio = useRef<HTMLAudioElement>(null);
	const noVocalsAudio = useRef<HTMLAudioElement>(null);
	const captionTextEdit = useRef<HTMLDialogElement>(null);
	const captionTextEditInput = useRef<HTMLInputElement>(null);
	const time = useRef<HTMLSpanElement>(null);
	const scrollerCursor = useRef<HTMLDivElement>(null);

	const captions = useRef<RenderingCaptions>(null);
	const undoLog = useRef<ActionGroup[]>([]);
	const redoLog = useRef<ActionGroup[]>([]);
	const dragging = useRef<DraggingState>(null);
	const selectedCaption = useRef<number | null>(null);
	const lastFetch = useRef<number>(Date.now());

	const [paused, setPaused] = useState(true);
	const [visibleSt, setVisibleSt] = useState<RenderingSubtitle[]>([]);
	const [editMode, setEditMode] = useState(false);
	const [vocals, setVocals] = useState(false);
	const [tracks, setTracks] = useState<(string | undefined)[]>([]);

	class ActionGroup {
		actions: Action[];
		constructor(actions: Action[]) {
			this.actions = actions;
		}
		apply(clearRedoLog = true) {
			for (const action of this.actions) {
				action._applyForGroup();
			}
			if (clearRedoLog) {
				redoLog.current = [];
			}
			undoLog.current.push(this);
		}
		undo() {
			for (const action of this.actions) {
				action._undoForGroup();
			}
			redoLog.current.push(this);
		}
	}

	class Action {
		type: ActionType;
		from: Partial<RenderingSubtitle>;
		to: Partial<RenderingSubtitle>;
		constructor(
			type: ActionType,
			from: Partial<RenderingSubtitle>,
			to: Partial<RenderingSubtitle>,
		) {
			this.type = type;
			this.from = from;
			this.to = to;
		}

		group() {
			return new ActionGroup([this]);
		}

		#apply() {
			switch (this.type) {
				case "delete": {
					const removed = captions.current?.captions.splice(
						captions.current.captions.findIndex((st) => st.id === this.from.id),
						1,
					);
					if (removed) this.from = removed[0];
					break;
				}

				case "edit": {
					if (!this.to.start || !this.to.end || !this.to.text) break;
					const st = captions.current?.captions.find(
						(st) => st.id === this.to.id,
					);
					if (st) {
						st.text = this.to.text;
						st.character = this.to.character;
						st.start = this.to.start;
						st.end = this.to.end;
					}
					break;
				}

				case "add": {
					const newSt = {
						...this.to,
						id:
							Math.max(
								...(captions.current?.captions.map((st) => st.id) ?? [0]),
							) + 1,
					};
					captions.current?.captions.push(newSt as RenderingSubtitle);
					this.to = newSt;
					break;
				}
			}
		}

		#undo() {
			switch (this.type) {
				case "delete": {
					if (this.from)
						captions.current?.captions.push(this.from as RenderingSubtitle);
					break;
				}

				case "edit": {
					if (!this.from.start || !this.from.end || !this.from.text) break;
					const st = captions.current?.captions.find(
						(st) => st.id === this.from?.id,
					);
					if (st) {
						st.text = this.from.text;
						st.character = this.from.character;
						st.start = this.from.start;
						st.end = this.from.end;
					}
					break;
				}

				case "add": {
					captions.current?.captions.splice(
						captions.current.captions.findIndex((st) => this.to?.id === st.id),
						1,
					);
					break;
				}
			}
		}

		_applyForGroup() {
			this.#apply();
		}

		_undoForGroup() {
			this.#undo();
		}
	}

	function getSelectedCaption() {
		return captions.current?.captions.find(
			(st) => st.id === selectedCaption.current,
		);
	}

	function switchAudio(vocals: boolean) {
		if (!playerRef.current) return;
		if (currentAudio) {
			currentAudio.current?.pause();
		}

		currentAudio.current = vocals ? vocalsAudio.current : noVocalsAudio.current;

		if (currentAudio.current)
			currentAudio.current.currentTime = playerRef.current?.currentTime ?? 0;

		if (!playerRef.current?.paused) currentAudio.current?.play();
	}

	useEffect(() => {
		if (!playerRef.current) return;

		const play = () => {
			currentAudio.current?.play();
		};
		const seeked = () => {
			if (!currentAudio.current) return;
			currentAudio.current.currentTime = playerRef.current?.currentTime ?? 0;
		};
		const pause = () => {
			currentAudio.current?.pause();
		};
		const timeupdate = () => {
			if (!currentAudio.current) return;
			currentAudio.current.currentTime = playerRef.current?.currentTime ?? 0;
		};

		playerRef.current.addEventListener("play", play);
		playerRef.current.addEventListener("pause", pause);
		playerRef.current.addEventListener("seeked", seeked);
		playerRef.current.addEventListener("timeupdate", timeupdate);

		switchAudio(vocals);

		() => {
			if (!playerRef.current) return;
			playerRef.current.removeEventListener("play", play);
			playerRef.current.removeEventListener("pause", pause);
			playerRef.current.removeEventListener("seeked", seeked);
			playerRef.current.removeEventListener("timeupdate", timeupdate);
		};
	}, []);

	function refreshVisibleSt() {
		const VisibleTime = window.innerWidth / CaptionsScale;
		const currentTime = playerRef.current?.currentTime ?? 0;
		const visibleSubtitles =
			captions.current?.captions.filter(
				(st) =>
					Math.min(
						Math.abs(st.start - currentTime),
						Math.abs(st.end - currentTime),
					) < VisibleTime ||
					(st.start <= currentTime && currentTime <= st.end),
			) ?? [];
		for (const st of visibleSubtitles) {
			const children = document?.querySelectorAll(
				`[st-id="${st.id}"]`,
			) as NodeListOf<HTMLDivElement>;
			for (const child of children) {
				const size = currentTime - st.start;
				(
					child.querySelector(".caption_overlap") as HTMLDivElement
				).style.maxWidth = `${(size >= 0 ? size : 0) * CaptionsScale}px`;
				child.style.transform = `translateX(${(st.start - currentTime) * CaptionsScale}px)`;
				child.style.visibility = "visible";

				const texts = child.querySelectorAll(
					".caption_text",
				) as NodeListOf<HTMLDivElement>;
				texts[0].style.transform = "";
				const scale =
					((st.end - st.start) * CaptionsScale) / texts[0].offsetWidth;
				for (const text of texts) {
					text.style.transform = `scaleX(${scale})`;
				}
			}
		}
		setTracks((tracks) => {
			for (const st of visibleSubtitles) {
				if (!tracks.includes(st.character)) {
					const emptyTrackIndex = tracks.findIndex(
						(track) => !visibleSubtitles.find((s) => s.character === track),
					);
					if (emptyTrackIndex === -1) {
						tracks.push(st.character);
					} else {
						tracks.splice(emptyTrackIndex, 1, st.character);
					}
				}
			}
			return tracks;
		});
		setVisibleSt(visibleSubtitles);

		if (time.current)
			time.current.innerHTML = `${displayTime(playerRef.current?.currentTime ?? 0)}/${displayTime(playerRef.current?.duration ?? 0)}`;
	}

	useEffect(() => {
		socket?.emit("fetchSubtitles");

		socket?.on("subtitles", (data) => {
			if (data)
				captions.current = {
					...data,
					captions: data.captions.map((st, id) => ({ ...st, id })),
				};

			if (captions.current && !captions.current.characters)
				captions.current.characters = [];

			for (const st of captions.current?.captions ?? []) {
				if (
					st.character &&
					captions.current?.characters?.findIndex(
						(char) => st.character === char.name,
					) === -1
				) {
					captions.current.characters.push({ name: st.character });
				}
			}
		});

		let interval = undefined;
		interval = setInterval(() => {
			refreshVisibleSt();

			if (scrollerCursor.current) {
				scrollerCursor.current.style.left = `calc(${
					((playerRef.current?.currentTime ?? 0) /
						(playerRef.current?.duration ?? 1)) *
					100
				}% - 1em)`;
			}
		}, UpdateRate);

		return () => {
			clearInterval(interval);
			socket?.off("subtitles");
		};
	}, []);

	useEffect(() => {
		function handleKeyPress(e: KeyboardEvent) {
			if (captionTextEdit.current?.open) return;
			switch (e.code) {
				case "KeyE":
					toggleEditMode();
					break;
				case "Space":
					togglePause();
					break;
				case "KeyA":
					stepBackward();
					break;
				case "KeyD":
					stepForward();
					break;

				case "KeyR":
					if (selectedCaption.current !== null && editMode) {
						const action = new Action(
							"delete",
							{ id: selectedCaption.current },
							{},
						);
						action._applyForGroup();
						undoLog.current.push(action.group());
					}
					break;

				case "KeyW":
					if (editMode) {
						if (e.shiftKey) {
							const latestAction = undoLog.current.pop();
							latestAction?.undo();
						} else {
							const st = getSelectedCaption();
							if (st && captionTextEditInput.current) {
								captionTextEdit.current?.showModal();
								captionTextEditInput.current.value = st.text;
								e.preventDefault();
							}
						}
					}
					break;

				case "KeyY":
					if (e.shiftKey && editMode) {
						const latestAction = redoLog.current.pop();
						latestAction?.apply(false);
					}
					break;

				case "KeyC":
					if (e.shiftKey && editMode && selectedCaption.current !== null) {
						const st = getSelectedCaption();
						if (st) {
							const action = new Action(
								"add",
								{},
								{ ...st, character: undefined },
							);
							action.group().apply();
						}
					} else {
						selectedCaption.current = null;
					}
					break;
				case "KeyS": {
					if (!editMode) return;
					const currentTime = playerRef.current?.currentTime ?? 0;
					const st = getSelectedCaption();

					if (st && currentTime > st.start && currentTime < st.end) {
						const timeIndex = currentTime - st.start;
						const duration = st.end - st.start;
						const letterIndex = Math.round(
							(timeIndex / duration) * st.text.length,
						);
						const [left, right] = smartSplit(st.text, letterIndex);
						if (right) {
							const edit = new Action(
								"edit",
								{ ...st },
								{ ...st, end: currentTime, text: left },
							);
							const add = new Action(
								"add",
								{},
								{ ...st, start: currentTime, text: right },
							);
							const actions = new ActionGroup([edit, add]);
							actions.apply();
						}
					}
					break;
				}

				default:
					break;
			}
		}

		document.addEventListener("keypress", handleKeyPress);

		return () => {
			document.removeEventListener("keypress", handleKeyPress);
		};
	}, [editMode, paused, vocals]);

	useEffect(() => {
		socket?.on(
			"videoState",
			(changePaused, timestamp, vocals, accountForPing) => {
				const ping = (Date.now() - lastFetch.current) / 2;
				const newTimestamp =
					accountForPing && !changePaused
						? (timestamp + ping) / 1000
						: timestamp / 1000;
				if (!playerRef.current || dragging.current) return;
				if (Math.abs(newTimestamp - playerRef.current.currentTime) > 0.3) {
					playerRef.current.currentTime = newTimestamp;
				}

				if (changePaused) {
					playerRef.current.pause();
				} else {
					playerRef.current.play();
				}
				switchAudio(vocals);
				setVocals(vocals);
				setPaused(changePaused);
			},
		);

		socket?.emit("fetchVideoState");
		lastFetch.current = Date.now();

		const interval = setInterval(() => {
			socket?.emit("fetchVideoState");
			lastFetch.current = Date.now();
		}, 5000);

		return () => {
			socket?.off("videoState");
			clearInterval(interval);
		};
	}, []);

	const onMouseDown = (e: React.TouchEvent | React.MouseEvent) => {
		if (!editMode) {
			const st = getSelectedCaption();
			if (!st) return;
			const clientX = "clientX" in e ? e.clientX : e.touches[0].clientX;
			dragging.current = {
				mouse: clientX,
				time: playerRef.current?.currentTime ?? 0,
				mode: "captions-scroll",
			};
		}
	};

	const onMouseMove = (e: React.TouchEvent | React.MouseEvent) => {
		const clientX = "clientX" in e ? e.clientX : e.touches[0].clientX;
		if (dragging.current && playerRef.current) {
			if (dragging.current.mode.includes("scroll")) {
				playerRef.current.currentTime =
					dragging.current.mode === "captions-scroll"
						? dragging.current.time +
							(dragging.current.mouse - clientX) / CaptionsScale
						: (clientX / window.innerWidth) * playerRef.current.duration;
			} else if (dragging.current.mode.includes("caption-")) {
				const st = getSelectedCaption();
				if (!st) return;
				let start: number | undefined;
				let end: number | undefined;
				const duration = st.end - st.start;

				switch (dragging.current.mode) {
					case "caption-edit":
						{
							st.character = dragging.current.track;
							start =
								dragging.current.time +
								(clientX - dragging.current.mouse) / CaptionsScale;
							end = duration + start;
						}

						break;

					case "caption-crop-left": {
						start =
							dragging.current.time +
							(clientX - dragging.current.mouse) / CaptionsScale;
						break;
					}
					case "caption-crop-right": {
						end =
							dragging.current.time +
							(clientX - dragging.current.mouse) / CaptionsScale;
					}
				}

				const currentTime = playerRef.current.currentTime;
				//Snap
				if (start !== undefined && Math.abs(start - currentTime) < SnapDiff) {
					st.start = currentTime;
					if (end !== undefined)
						st.end =
							dragging.current.mode === "caption-edit"
								? currentTime + duration
								: end;
				} else if (
					end !== undefined &&
					Math.abs(end - currentTime) < SnapDiff
				) {
					if (start !== undefined)
						st.start =
							dragging.current.mode === "caption-edit"
								? currentTime - duration
								: start;
					st.end = currentTime;
				} else {
					if (start !== undefined) st.start = start;
					if (end !== undefined) st.end = end;
				}
			}
		}
	};

	const onMouseUp = () => {
		if (dragging.current?.mode.includes("scroll"))
			socket?.emit(
				"togglePause",
				paused,
				(playerRef.current?.currentTime ?? 0) * 1000,
				vocals,
			);

		if (dragging.current?.mode.includes("caption-")) {
			const st = getSelectedCaption();
			if (st) {
				const action = new Action(
					"edit",
					{
						...st,
						start: dragging.current.origin?.start,
						end: dragging.current.origin?.end,
						character: dragging.current.originalCharacter,
					},
					{
						...st,
					},
				);
				action.group().apply();
			}
		}

		dragging.current = null;
	};

	function stepForward() {
		if (!playerRef.current || !captions.current) return;
		for (const st of captions.current.captions.sort(
			(a, b) => a.start - b.start,
		)) {
			if (st.start - (playerRef.current?.currentTime ?? 0) > 0.001) {
				const newTime = st ? st.start : 0;
				playerRef.current.currentTime = newTime;
				socket?.emit("togglePause", paused, newTime * 1000, vocals);
				selectedCaption.current = st.id;
				return st;
			}
		}
	}

	function stepBackward() {
		if (!playerRef.current || !captions.current) return;
		captions.current.captions.sort((a, b) => a.start - b.start);

		for (let i = captions.current.captions.length - 1; i >= 0; i--) {
			const st = captions.current.captions[i];
			if ((playerRef.current?.currentTime ?? 0) - st.start > 0.0001) {
				const newTime = st ? st.start : 0;
				playerRef.current.currentTime = newTime;
				socket?.emit("togglePause", paused, newTime * 1000, vocals);
				selectedCaption.current = st.id;
				return st;
			}
		}
	}

	function togglePause() {
		setPaused((p) => !p);
		if (paused) {
			playerRef.current?.play();
		} else {
			playerRef.current?.pause();
		}
		socket?.emit(
			"togglePause",
			!paused,
			(playerRef.current?.currentTime ?? 0) * 1000,
			vocals,
		);
	}

	function toggleEditMode() {
		if (editMode) {
			socket?.emit("newSubtitles", {
				characters: captions.current?.characters ?? [],
				captions:
					captions.current?.captions.map(
						(st) =>
							({
								text: st.text,
								character: st.character,
								start: st.start,
								end: st.end,
							}) as Subtitle,
					) ?? [],
			});
		}
		setEditMode((e) => !e);
	}

	return (
		<div
			className="dubbing"
			onMouseUp={onMouseUp}
			onTouchEnd={onMouseUp}
			onMouseMove={onMouseMove}
			onTouchMove={onMouseMove}
			onMouseLeave={onMouseUp}
		>
			<BackArrow
				onClick={() => {
					setEpisode(null);
				}}
			/>
			<dialog
				ref={captionTextEdit}
				onClose={() => {
					const st = getSelectedCaption();
					if (!st) return;
					const action = new Action(
						"edit",
						{ ...st },
						{
							...st,
							text: captionTextEditInput.current?.value ?? "???",
						},
					);
					action.group().apply();
				}}
			>
				<form method="dialog">
					<input type="text" ref={captionTextEditInput} />
				</form>
			</dialog>
			<div className="video_overlay">
				<video
					src={`${baseUrl}/media/${episode}/video.mp4`}
					ref={playerRef}
					muted
				/>
				{/* biome-ignore lint/a11y/useMediaCaption: <explanation> */}
				<audio
					src={`${baseUrl}/media/${episode}/no_vocals.wav`}
					ref={noVocalsAudio}
				/>
				{/* biome-ignore lint/a11y/useMediaCaption: <explanation> */}
				<audio
					src={`${baseUrl}/media/${episode}/vocals.wav`}
					ref={vocalsAudio}
				/>
				<div id="video_info">
					<span ref={time} />
					{sdk && !editMode ? null : (
						<div id="room_code">
							<span>Code de session: </span>
							<span>{room}</span>
						</div>
					)}
				</div>
			</div>
			<div className="controls">
				<Button
					onClick={() => {
						socket?.emit(
							"togglePause",
							paused,
							(playerRef.current?.currentTime ?? 0) * 1000,
							!vocals,
						);
						switchAudio(!vocals);
						setVocals((e) => !e);
					}}
					icon={vocals ? faMicrophoneLines : faMicrophoneLinesSlash}
				/>
				<Button onClick={stepBackward} icon={faBackwardStep} />
				<Button onClick={togglePause} icon={paused ? faPlay : faPause} />
				<Button onClick={stepForward} icon={faForwardStep} />
				<Button onClick={toggleEditMode} icon={editMode ? faXmark : faPencil} />
			</div>
			<div id="scroller">
				<div
					id="scroller_cursor"
					ref={scrollerCursor}
					onMouseDown={() => {
						dragging.current = { mode: "scroll", mouse: 0, time: 0 };
					}}
				/>
			</div>
			<div
				ref={subtitlesParent}
				className="subtitles_parent"
				onMouseDown={onMouseDown}
				onTouchStart={onMouseDown}
			>
				{(!editMode
					? tracks.map((charName) =>
							captions.current?.characters?.find(
								(char) => char.name === charName,
							),
						)
					: [...(captions.current?.characters ?? []), undefined]
				).map((character) => (
					<CaptionTrack
						editMode={{ active: editMode, dragging, selectedCaption }}
						captions={captions}
						visibleSt={visibleSt}
						character={character}
						key={character?.name ?? "?"}
					/>
				))}
				<div id="time_indicator" />
			</div>
		</div>
	);
}
