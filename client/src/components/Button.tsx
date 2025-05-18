import type { IconProp } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export function Button({
	icon,
	onClick,
}: { icon: IconProp; onClick: () => void }) {
	return (
		<div onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
			<FontAwesomeIcon icon={icon} />
		</div>
	);
}
