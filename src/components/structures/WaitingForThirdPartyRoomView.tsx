/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { RefObject } from "react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { useRoomContext } from "../../contexts/RoomContext";
import ResizeNotifier from "../../utils/ResizeNotifier";
import { E2EStatus } from "../../utils/ShieldUtils";
import ErrorBoundary from "../views/elements/ErrorBoundary";
import LegacyRoomHeader from "../views/rooms/LegacyRoomHeader";
import RoomHeader from "../views/rooms/RoomHeader";
import ScrollPanel from "./ScrollPanel";
import EventTileBubble from "../views/messages/EventTileBubble";
import NewRoomIntro from "../views/rooms/NewRoomIntro";
import { UnwrappedEventTile } from "../views/rooms/EventTile";
import { _t } from "../../languageHandler";
import SdkConfig from "../../SdkConfig";
import SettingsStore from "../../settings/SettingsStore";

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
                {SettingsStore.getValue("feature_new_room_decoration_ui") ? (
                    <RoomHeader room={context.room!} />
                ) : (
                    <LegacyRoomHeader
                        room={context.room}
                        inRoom={true}
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
                )}
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
