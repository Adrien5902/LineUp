import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

interface Props {
	onClick: () => void;
}

export default function BackArrow({ onClick }: Props) {
	return <FontAwesomeIcon icon={faArrowLeft} id="back" onClick={onClick} />;
}
