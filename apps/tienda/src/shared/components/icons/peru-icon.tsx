import type { SVGProps } from "react";

export function PeruIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg
			{...props}
			aria-label="Peru"
			preserveAspectRatio="xMidYMid"
			role="img"
			viewBox="0 85.333 512 341.333"
			xmlns="http://www.w3.org/2000/svg"
		>
			<title>Peru</title>
			<path d="M0 85.331h512v341.326H0z" fill="#FFF" />
			<g fill="#D80027">
				<path d="M0 85.331h170.663v341.337H0zM341.337 85.331H512v341.337H341.337z" />
			</g>
		</svg>
	);
}
