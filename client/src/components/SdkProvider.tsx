import { DiscordSDK } from "@discord/embedded-app-sdk";
import { createContext, useContext } from "react";
import { clientId } from "../../../config";

interface Props {
	children: React.ReactNode;
}

let sdk: DiscordSDK | null;
try {
	sdk = new DiscordSDK(clientId);
} catch (error) {
	sdk = null;
}

export const baseUrl =
	import.meta.env.MODE === "development" || !sdk ? "/lineup" : "/.proxy";

const SDK = import.meta.env.MODE === "development" ? null : sdk;
const SdkContext = createContext<DiscordSDK | null>(SDK);

export default function SdkProvider({ children }: Props) {
	return <SdkContext.Provider value={SDK}>{children}</SdkContext.Provider>;
}

export const useSdk = () => useContext(SdkContext);
