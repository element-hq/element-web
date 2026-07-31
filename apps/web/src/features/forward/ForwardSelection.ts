/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

/** A short-lived client-only selection used by the multi-message forward menu. */
const selectedEvents = new Map<string, MatrixEvent>();

const eventKey = (event: MatrixEvent): string => `${event.getRoomId() ?? ""}|${event.getId() ?? event.getTs()}`;

export const addForwardSelection = (event: MatrixEvent): number => {
    selectedEvents.set(eventKey(event), event);
    return selectedEvents.size;
};

export const getForwardSelectionSize = (): number => selectedEvents.size;

/** Return and clear the selection once it is handed to the forwarding dialog. */
export const consumeForwardSelection = (): MatrixEvent[] => {
    const events = [...selectedEvents.values()].sort((a, b) => a.getTs() - b.getTs());
    selectedEvents.clear();
    return events;
};
