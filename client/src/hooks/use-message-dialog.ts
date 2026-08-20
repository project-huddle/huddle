import { useReducer } from "react";
import type { ChatMessage } from "@/lib/api";

type State = { mode: "closed" } | { mode: "editing"; message: ChatMessage; value: string } | { mode: "reporting"; message: ChatMessage; reason: string };
type Action = { type: "close" } | { type: "edit"; message: ChatMessage } | { type: "edit-value"; value: string } | { type: "report"; message: ChatMessage } | { type: "report-reason"; reason: string };

function reducer(state: State, action: Action): State {
	switch (action.type) {
		case "close": return { mode: "closed" };
		case "edit": return { mode: "editing", message: action.message, value: action.message.content };
		case "edit-value": return state.mode === "editing" ? { ...state, value: action.value } : state;
		case "report": return { mode: "reporting", message: action.message, reason: "" };
		case "report-reason": return state.mode === "reporting" ? { ...state, reason: action.reason } : state;
	}
}

export function useMessageDialog() {
	const [state, dispatch] = useReducer(reducer, { mode: "closed" });
	return {
		editing: state.mode === "editing" ? state.message : null,
		editValue: state.mode === "editing" ? state.value : "",
		reporting: state.mode === "reporting" ? state.message : null,
		reportReason: state.mode === "reporting" ? state.reason : "",
		setEditing: (message: ChatMessage | null) => dispatch(message ? { type: "edit", message } : { type: "close" }),
		setEditValue: (value: string) => dispatch({ type: "edit-value", value }),
		setReporting: (message: ChatMessage | null) => dispatch(message ? { type: "report", message } : { type: "close" }),
		setReportReason: (reason: string) => dispatch({ type: "report-reason", reason }),
	};
}
