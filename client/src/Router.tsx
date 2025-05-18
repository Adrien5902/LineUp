import { HashRouter, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSocket } from "./components/SocketProvider";
import { useSdk } from "./components/SdkProvider";
import Home from "./components/Home";
import Dubbing from "./components/Dubbing";
import Join from "./components/Join";

export function Router() {
	const socket = useSocket();
	const sdk = useSdk();

	const [episode, setEpisode] = useState<string | null>(null);
	const [room, setRoom] = useState<string | null>(
		sdk?.instanceId ?? (import.meta.env.MODE === "development" ? null : null),
	);
	function updateEpisode(e: string | null) {
		setEpisode(e);
		socket?.emit("setEpisode", e);
	}

	useEffect(() => {
		if (room && socket) socket?.emit("createOrJoinRoom", room);

		socket?.on("joinedRoom", (room) => {
			setRoom(room);
		});

		socket?.on("setEpisode", (episode) => {
			setEpisode(episode);
		});

		socket?.on("leftRoom", () => {
			setRoom(null);
		});

		return () => {
			socket?.off("leftRoom");
			socket?.off("joinedRoom");
			socket?.off("setEpisode");
		};
	}, [sdk?.instanceId]);

	return (
		<HashRouter>
			<Routes location={room ? (episode ? "/dubbing" : "/") : "/join"}>
				<Route
					path="/"
					element={<Home setEpisode={updateEpisode} room={room} />}
				/>
				<Route
					path="/dubbing"
					element={
						<Dubbing episode={episode} setEpisode={updateEpisode} room={room} />
					}
				/>
				<Route path="/join" element={<Join />} />
			</Routes>
		</HashRouter>
	);
}
