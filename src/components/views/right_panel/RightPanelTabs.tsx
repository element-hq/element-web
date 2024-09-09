/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { useRef } from "react";
import { NavBar, NavItem } from "@vector-im/compound-web";
import { Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import PosthogTrackers from "../../../PosthogTrackers";
import { useDispatcher } from "../../../hooks/useDispatcher";
import dispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import SettingsStore from "../../../settings/SettingsStore";
import { UIComponent, UIFeature } from "../../../settings/UIFeature";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { useIsVideoRoom } from "../../../utils/video-rooms";

function shouldShowTabsForPhase(phase?: RightPanelPhases): boolean {
    const tabs = [
        RightPanelPhases.RoomSummary,
        RightPanelPhases.RoomMemberList,
        RightPanelPhases.ThreadPanel,
        RightPanelPhases.Extensions,
    ];
    return !!phase && tabs.includes(phase);
}

type Props = {
    room?: Room;
    phase: RightPanelPhases;
};

export const RightPanelTabs: React.FC<Props> = ({ phase, room }): JSX.Element | null => {
    const threadsTabRef = useRef<HTMLButtonElement | null>(null);

    useDispatcher(dispatcher, (payload) => {
        // This actually focuses the threads tab, as its the only interactive element,
        // but at least it puts the user in the right area of the app.
        if (payload.action === Action.FocusThreadsPanel) {
            threadsTabRef.current?.focus();
        }
    });

    const isVideoRoom = useIsVideoRoom(room);

    if (!shouldShowTabsForPhase(phase)) return null;

    return (
        <NavBar className="mx_RightPanelTabs" aria-label="right panel" role="tablist">
            <NavItem
                aria-controls="room-summary-panel"
                id="room-summary-panel-tab"
                onClick={() => {
                    RightPanelStore.instance.pushCard({ phase: RightPanelPhases.RoomSummary }, true);
                }}
                active={phase === RightPanelPhases.RoomSummary}
            >
                {_t("right_panel|info")}
            </NavItem>
            <NavItem
                aria-controls="memberlist-panel"
                id="memberlist-panel-tab"
                onClick={(ev: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
                    RightPanelStore.instance.pushCard({ phase: RightPanelPhases.RoomMemberList }, true);
                    PosthogTrackers.trackInteraction("WebRightPanelRoomInfoPeopleButton", ev);
                }}
                active={phase === RightPanelPhases.RoomMemberList}
            >
                {_t("common|people")}
            </NavItem>
            <NavItem
                aria-controls="thread-panel"
                id="thread-panel-tab"
                onClick={() => {
                    RightPanelStore.instance.pushCard({ phase: RightPanelPhases.ThreadPanel }, true);
                }}
                active={phase === RightPanelPhases.ThreadPanel}
                ref={threadsTabRef}
            >
                {_t("common|threads")}
            </NavItem>
            {SettingsStore.getValue(UIFeature.Widgets) &&
                !isVideoRoom &&
                shouldShowComponent(UIComponent.AddIntegrations) && (
                    <NavItem
                        aria-controls="thread-panel"
                        id="extensions-panel-tab"
                        onClick={() => {
                            RightPanelStore.instance.pushCard({ phase: RightPanelPhases.Extensions }, true);
                        }}
                        active={phase === RightPanelPhases.Extensions}
                    >
                        {_t("common|extensions")}
                    </NavItem>
                )}
        </NavBar>
    );
};
