/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FC, useContext, useEffect, type AriaRole, useCallback } from "react";

import type { Room } from "matrix-js-sdk/src/matrix";
import { type Call, CallEvent } from "../../../models/Call";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import AppTile from "../elements/AppTile";
import { CallStore } from "../../../stores/CallStore";
import { SdkContextClass } from "../../../contexts/SDKContext";
import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";
import { useCall } from "../../../hooks/useCall";

interface JoinCallViewProps {
    room: Room;
    resizing: boolean;
    call: Call;
    skipLobby?: boolean;
    role?: AriaRole;
    onClose: () => void;
}

const JoinCallView: FC<JoinCallViewProps> = ({ room, resizing, call, skipLobby, role, onClose }) => {
    const cli = useContext(MatrixClientContext);
    useTypedEventEmitter(call, CallEvent.Close, onClose);

    useEffect(() => {
        // We'll take this opportunity to tidy up our room state
        call.clean();
    }, [call]);

    useEffect(() => {
        // Always update the widget data so that we don't ignore "skipLobby" accidentally.
        call.widget.data ??= {};
        call.widget.data.skipLobby = skipLobby;
    }, [call.widget, skipLobby]);

    const disconnectAllOtherCalls: () => Promise<void> = useCallback(async () => {
        // The stickyPromise has to resolve before the widget actually becomes sticky.
        // We only let the widget become sticky after disconnecting all other active calls.
        const calls = [...CallStore.instance.connectedCalls].filter(
            (call) => SdkContextClass.instance.roomViewStore.getRoomId() !== call.roomId,
        );
        await Promise.all(calls.map(async (call) => await call.disconnect()));
    }, []);

    return (
        <div className="mx_CallView" role={role}>
            <AppTile
                app={call.widget}
                room={room}
                userId={cli.credentials.userId!}
                creatorUserId={call.widget.creatorUserId}
                waitForIframeLoad={call.widget.waitForIframeLoad}
                showMenubar={false}
                pointerEvents={resizing ? "none" : undefined}
                stickyPromise={disconnectAllOtherCalls}
            />
        </div>
    );
};

interface CallViewProps {
    room: Room;
    resizing: boolean;
    skipLobby?: boolean;
    role?: AriaRole;
    /**
     * Callback for when the user closes the call.
     */
    onClose: () => void;
}

export const CallView: FC<CallViewProps> = ({ room, resizing, skipLobby, role, onClose }) => {
    const call = useCall(room.roomId);

    return (
        call && (
            <JoinCallView
                room={room}
                resizing={resizing}
                call={call}
                skipLobby={skipLobby}
                role={role}
                onClose={onClose}
            />
        )
    );
};
