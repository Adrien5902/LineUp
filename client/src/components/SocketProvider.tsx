import { createContext, useContext } from "react";
import { io, type Socket } from "socket.io-client";
import type {
	ClientToServerEvents,
	ServerToClientEvents,
} from "../../../shared";
import { useSdk } from "./SdkProvider";
import { PORT, serverURL } from "../../../config";

interface Props {
	children: React.ReactNode;
}

const SocketContext = createContext<Socket<
	ServerToClientEvents,
	ClientToServerEvents
> | null>(null);

export default function SocketProvider({ children }: Props) {
	const sdk = useSdk();
	const value = io(
		import.meta.env.MODE === "development" || !sdk
			? `${serverURL}:${PORT}`
			: "/",
		{
			path:
				import.meta.env.MODE === "development" || !sdk
					? undefined
					: "/.proxy/socket/",
		},
	);

	return (
		<SocketContext.Provider value={value}>{children}</SocketContext.Provider>
	);
}

export const useSocket = () => useContext(SocketContext);
