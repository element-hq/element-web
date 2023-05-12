/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { RefObject } from "react";

import { useRoomContext } from "../../contexts/RoomContext";
import ResizeNotifier from "../../utils/ResizeNotifier";
import { E2EStatus } from "../../utils/ShieldUtils";
import ErrorBoundary from "../views/elements/ErrorBoundary";
import RoomHeader from "../views/rooms/RoomHeader";
import ScrollPanel from "./ScrollPanel";
import EventTileBubble from "../views/messages/EventTileBubble";
import NewRoomIntro from "../views/rooms/NewRoomIntro";
import { UnwrappedEventTile } from "../views/rooms/EventTile";
import { _t } from "../../languageHandler";
import SdkConfig from "../../SdkConfig";

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
    const context = useRoomContext();
    const brand = SdkConfig.get().brand;

    return (
        <div className="mx_RoomView mx_RoomView--local">
            <ErrorBoundary>
                <RoomHeader
                    room={context.room}
                    inRoom={true}
                    onSearchClick={null}
                    onInviteClick={null}
                    onForgetClick={null}
                    e2eStatus={E2EStatus.Normal}
                    onAppsClick={null}
                    appsShown={false}
                    excludedRightPanelPhaseButtons={[]}
                    showButtons={false}
                    enableRoomOptionsMenu={false}
                    viewingCall={false}
                    activeCall={null}
                />
                <main className="mx_RoomView_body" ref={roomView}>
                    <div className="mx_RoomView_timeline">
                        <ScrollPanel className="mx_RoomView_messagePanel" resizeNotifier={resizeNotifier}>
                            <EventTileBubble
                                className="mx_cryptoEvent mx_cryptoEvent_icon"
                                title={_t("Waiting for users to join %(brand)s", { brand })}
                                subtitle={_t(
                                    "Once invited users have joined %(brand)s, " +
                                        "you will be able to chat and the room will be end-to-end encrypted",
                                    { brand },
                                )}
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
