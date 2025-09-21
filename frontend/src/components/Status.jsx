import React from "react";

export default function Status({ state }) {
    if (!state) return null;
    return <div className={`alert alert-${state.type} mb-3`}>{state.text}</div>;
}
