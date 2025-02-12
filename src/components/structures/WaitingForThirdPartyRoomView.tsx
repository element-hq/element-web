/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type RefObject } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import type ResizeNotifier from "../../utils/ResizeNotifier";
import ErrorBoundary from "../views/elements/ErrorBoundary";
import RoomHeader from "../views/rooms/RoomHeader/RoomHeader.tsx";
import ScrollPanel from "./ScrollPanel";
import EventTileBubble from "../views/messages/EventTileBubble";
import NewRoomIntro from "../views/rooms/NewRoomIntro";
import { UnwrappedEventTile } from "../views/rooms/EventTile";
import { _t } from "../../languageHandler";
import SdkConfig from "../../SdkConfig";
import { useScopedRoomContext } from "../../contexts/ScopedRoomContext.tsx";

interface Props {
    roomView: RefObject<HTMLElement>;
    resizeNotifier: ResizeNotifier;
    inviteEvent: MatrixEvent;
}

/**
 * Component that displays a waiting room for an encrypted DM with a third party invite.
 * If encryption by default is enabled, DMs with a third party invite should be encrypted as well.
 * To avoid UTDs, users are shown a waiting room until the others have joined.
 */
export const WaitingForThirdPartyRoomView: React.FC<Props> = ({ roomView, resizeNotifier, inviteEvent }) => {
    const context = useScopedRoomContext("room");
    const brand = SdkConfig.get().brand;

    return (
        <div className="mx_RoomView mx_RoomView--local">
            <ErrorBoundary>
                <RoomHeader room={context.room!} />
                <main className="mx_RoomView_body" ref={roomView}>
                    <div className="mx_RoomView_timeline">
                        <ScrollPanel className="mx_RoomView_messagePanel" resizeNotifier={resizeNotifier}>
                            <EventTileBubble
                                className="mx_cryptoEvent mx_cryptoEvent_icon"
                                title={_t("room|waiting_for_join_title", { brand })}
                                subtitle={_t("room|waiting_for_join_subtitle", { brand })}
                            />
                            <NewRoomIntro />
                            <UnwrappedEventTile mxEvent={inviteEvent} />
                        </ScrollPanel>
                    </div>
                </main>
            </ErrorBoundary>
        </div>
    );
};
