/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import LinkIcon from "@vector-im/compound-design-tokens/assets/web/icons/link";

import { RovingAccessibleButton } from "../../../../accessibility/RovingTabIndex";
import Toolbar from "../../../../accessibility/Toolbar";
import { _t } from "../../../../languageHandler";
import { Icon as ViewInRoomIcon } from "../../../../../res/img/element-icons/view-in-room.svg";
import { type ButtonEvent } from "../../elements/AccessibleButton";

export function EventTileThreadToolbar({
    viewInRoom,
    copyLinkToThread,
}: {
    viewInRoom: (evt: ButtonEvent) => void;
    copyLinkToThread: (evt: ButtonEvent) => void;
}): JSX.Element {
    return (
        <Toolbar className="mx_MessageActionBar" aria-label={_t("timeline|mab|label")} aria-live="off">
            <RovingAccessibleButton
                className="mx_MessageActionBar_iconButton"
                onClick={viewInRoom}
                title={_t("timeline|mab|view_in_room")}
                key="view_in_room"
            >
                <ViewInRoomIcon />
            </RovingAccessibleButton>
            <RovingAccessibleButton
                className="mx_MessageActionBar_iconButton"
                onClick={copyLinkToThread}
                title={_t("timeline|mab|copy_link_thread")}
                key="copy_link_to_thread"
            >
                <LinkIcon />
            </RovingAccessibleButton>
        </Toolbar>
    );
}
