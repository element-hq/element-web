/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { FC, useContext, useEffect, AriaRole, useCallback } from "react";

import type { Room } from "matrix-js-sdk/src/matrix";
import { Call, ConnectionState, ElementCall } from "../../../models/Call";
import { useCall } from "../../../hooks/useCall";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import AppTile from "../elements/AppTile";
import { CallStore } from "../../../stores/CallStore";
import { SdkContextClass } from "../../../contexts/SDKContext";

interface JoinCallViewProps {
    room: Room;
    resizing: boolean;
    call: Call;
    skipLobby?: boolean;
    role?: AriaRole;
}

const JoinCallView: FC<JoinCallViewProps> = ({ room, resizing, call, skipLobby, role }) => {
    const cli = useContext(MatrixClientContext);

    useEffect(() => {
        // We'll take this opportunity to tidy up our room state
        call.clean();
    }, [call]);

    useEffect(() => {
        // Always update the widget data so that we don't ignore "skipLobby" accidentally.
        call.widget.data ??= {};
        call.widget.data.skipLobby = skipLobby;
    }, [call.widget, skipLobby]);

    useEffect(() => {
        if (call.connectionState === ConnectionState.Disconnected) {
            // immediately start the call
            // (this will start the lobby view in the widget and connect to all required widget events)
            call.start();
        }
        return (): void => {
            // If we are connected the widget is sticky and we do not want to destroy the call.
            if (!call.connected) call.destroy();
        };
    }, [call]);
    const disconnectAllOtherCalls: () => Promise<void> = useCallback(async () => {
        // The stickyPromise has to resolve before the widget actually becomes sticky.
        // We only let the widget become sticky after disconnecting all other active calls.
        const calls = [...CallStore.instance.activeCalls].filter(
            (call) => SdkContextClass.instance.roomViewStore.getRoomId() !== call.roomId,
        );
        await Promise.all(calls.map(async (call) => await call.disconnect()));
    }, []);
    return (
        <div className="mx_CallView">
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
    /**
     * If true, the view will be blank until a call appears. Otherwise, the join
     * button will create a call if there isn't already one.
     */
    waitForCall: boolean;
    skipLobby?: boolean;
    role?: AriaRole;
}

export const CallView: FC<CallViewProps> = ({ room, resizing, waitForCall, skipLobby, role }) => {
    const call = useCall(room.roomId);

    useEffect(() => {
        if (call === null && !waitForCall) {
            ElementCall.create(room, skipLobby);
        }
    }, [call, room, skipLobby, waitForCall]);
    if (call === null) {
        return null;
    } else {
        return <JoinCallView room={room} resizing={resizing} call={call} skipLobby={skipLobby} role={role} />;
    }
};
