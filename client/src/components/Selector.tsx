import { useState } from "react";

interface Props {
	parts: {
		title: string;
		content: React.ReactNode;
	}[];
}

export default function Selector({ parts }: Props) {
	const [selected, setSelected] = useState(0);

	return (
		<div className="selector">
			<div className="selector_header">
				{parts.map((part, i) => (
					<div
						key={part.title}
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => {
							setSelected(i);
						}}
						style={{
							backgroundColor: selected === i ? "var(--accent)" : "",
						}}
					>
						<span>{part.title}</span>
					</div>
				))}
			</div>
			<div className="selector_content">{parts[selected].content}</div>
		</div>
	);
}
