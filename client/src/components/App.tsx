import { Router } from "../Router";
import SdkProvider from "./SdkProvider";
import SocketProvider from "./SocketProvider";

function App() {
	return (
		<SdkProvider>
			<SocketProvider>
				<Router />
			</SocketProvider>
		</SdkProvider>
	);
}

export default App;
