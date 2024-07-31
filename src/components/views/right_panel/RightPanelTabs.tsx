/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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
