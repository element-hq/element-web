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

import React from "react";

import { RovingAccessibleTooltipButton } from "../../../../accessibility/RovingTabIndex";
import Toolbar from "../../../../accessibility/Toolbar";
import { _t } from "../../../../languageHandler";
import { Icon as LinkIcon } from "../../../../../res/img/element-icons/link.svg";
import { Icon as ViewInRoomIcon } from "../../../../../res/img/element-icons/view-in-room.svg";
import { ButtonEvent } from "../../elements/AccessibleButton";

export function EventTileThreadToolbar({
    viewInRoom,
    copyLinkToThread,
}: {
    viewInRoom: (evt: ButtonEvent) => void;
    copyLinkToThread: (evt: ButtonEvent) => void;
}): JSX.Element {
    return (
        <Toolbar className="mx_MessageActionBar" aria-label={_t("Message Actions")} aria-live="off">
            <RovingAccessibleTooltipButton
                className="mx_MessageActionBar_iconButton"
                onClick={viewInRoom}
                title={_t("View in room")}
                key="view_in_room"
            >
                <ViewInRoomIcon />
            </RovingAccessibleTooltipButton>
            <RovingAccessibleTooltipButton
                className="mx_MessageActionBar_iconButton"
                onClick={copyLinkToThread}
                title={_t("Copy link to thread")}
                key="copy_link_to_thread"
            >
                <LinkIcon />
            </RovingAccessibleTooltipButton>
        </Toolbar>
    );
}
