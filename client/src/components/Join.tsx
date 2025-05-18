import { useEffect, useRef } from "react";
import { useSocket } from "./SocketProvider";
import Selector from "./Selector";

export default function Join() {
	const socket = useSocket();
	const err = useRef<HTMLSpanElement>(null);
	const roomCodeInput = useRef<HTMLInputElement>(null);

	useEffect(() => {
		socket?.on("unavailableRoom", () => {
			if (err.current)
				err.current.innerHTML = "Code incorrect ou session terminée";
		});

		() => {
			socket?.off("unavailableRoom");
		};
	}, []);

	return (
		<div id="join">
			<img src="./logo_horizontal.png" alt="LineUp" className="logo" />
			<Selector
				parts={[
					{
						title: "Rejoindre une session",
						content: (
							<div className="join_session_selector_content">
								<input type="text" ref={roomCodeInput} />
								<button
									type="button"
									className="button"
									onClick={() => {
										if (roomCodeInput.current?.value) {
											socket?.emit("joinRoom", roomCodeInput.current?.value);
										} else if (err.current) {
											err.current.innerHTML = "Veuillez rentrer le code";
										}
									}}
								>
									<span>Rejoindre</span>
								</button>
							</div>
						),
					},
					{
						title: "Créer une session",
						content: (
							<div className="join_session_selector_content">
								<button
									type="button"
									className="button"
									onClick={() => {
										socket?.emit("createOrJoinRoom");
									}}
								>
									<span>Créer</span>
								</button>
							</div>
						),
					},
				]}
			/>
		</div>
	);
}
