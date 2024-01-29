import { Component, JSX, Show } from "solid-js";

type ModalProps = {
	isOpen: boolean;
	onClose: () => void;
	children: JSX.Element;
};

export const Modal: Component<ModalProps> = (props) => {
	// Function to close modal when clicking on overlay
	const handleOverlayClick = (e: MouseEvent): void => {
		if (e.target === e.currentTarget) {
			props.onClose();
		}
	};

	return (
		<Show when={props.isOpen}>
			<div
				class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center"
				onClick={handleOverlayClick}
			>
				<div class="bg-gray-900 p-4 rounded">
					{/* Modal content goes here */}
					{props.children}
				</div>
			</div>
		</Show>
	);
};
