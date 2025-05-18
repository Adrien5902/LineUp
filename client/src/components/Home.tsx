import BackArrow from "./BackArrow";
import { useEffect, useState } from "react";
import { baseUrl, useSdk } from "./SdkProvider";
import { useSocket } from "./SocketProvider";

interface Props {
	setEpisode: (e: string | null) => void;
	room: string | null;
}

export default function Home({ setEpisode, room }: Props) {
	const socket = useSocket();
	const sdk = useSdk();
	const [episodes, setEpisodes] = useState<string[]>([]);

	useEffect(() => {
		socket?.emit("getEpisodes");

		socket?.on("episodes", (episodes) => {
			setEpisodes(episodes);
		});

		return () => {
			socket?.off("episodes");
		};
	}, []);

	return (
		<>
			<BackArrow
				onClick={() => {
					socket?.emit("leaveRoom");
				}}
			/>
			<h2>Choisir un épisode à doubler :</h2>
			{sdk ? null : <h3>Code de session {room}</h3>}
			<div className="episode_selector">
				{episodes.map((e) => (
					<div
						key={e}
						onClick={() => {
							setEpisode(e);
						}}
					>
						<img src={`${baseUrl}/media/${e}/image.png`} alt="" />
						{e.split("-").map((text) => (
							<span key={text}>{text}</span>
						))}
					</div>
				))}
			</div>
		</>
	);
}
