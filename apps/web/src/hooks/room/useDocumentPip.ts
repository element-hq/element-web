/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";
import { useCallback, useContext } from "react";

import { useCall, useConnectionState } from "../useCall";
import { ConnectionState, ElementCall } from "../../models/Call";
import { useSettingValue } from "../useSettings";
import { useEventEmitterState } from "../useEventEmitter";
import { DocumentPipStore, DocumentPipStoreEvent } from "../../stores/DocumentPipStore";
import { type LocalRoom } from "../../models/LocalRoom";
import { SDKContext } from "../../contexts/SDKContext";

/**
 * Whether, and how, the room's call can be shown in a browser Document Picture-in-Picture window.
 *
 * Available only for a connected call rendered by the Element Call React component (the
 * `feature_element_call_react` transport), in a browser that has the API.
 */
export const useDocumentPip = (
    room: Room | LocalRoom,
): {
    /** Whether the button to move the call into a Picture-in-Picture window should be offered. */
    available: boolean;
    /** Whether the room's call is in the Picture-in-Picture window right now. */
    active: boolean;
    /** Moves the call into the window, or brings it back. Must be called from a user gesture. */
    toggle: () => void;
} => {
    const { documentPipStore } = useContext(SDKContext);
    const call = useCall(room.roomId);
    const connected = useConnectionState(call) === ConnectionState.Connected;
    const reactComponent = useSettingValue("feature_element_call_react");
    const shownCall = useEventEmitterState(documentPipStore, DocumentPipStoreEvent.Update, () => documentPipStore.call);

    const elementCall = call instanceof ElementCall ? call : null;
    const active = elementCall !== null && shownCall === elementCall;
    const available = DocumentPipStore.isSupported && reactComponent && connected && elementCall !== null;

    const toggle = useCallback((): void => {
        if (elementCall === null) return;
        if (active) documentPipStore.close();
        else void documentPipStore.open(elementCall);
    }, [documentPipStore, elementCall, active]);

    return { available, active, toggle };
};
