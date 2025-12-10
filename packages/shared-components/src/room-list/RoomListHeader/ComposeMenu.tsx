/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useState, type JSX } from "react";
import { IconButton, Menu, MenuItem } from "@vector-im/compound-web";
import ComposeIcon from "@vector-im/compound-design-tokens/assets/web/icons/compose";
import ChatIcon from "@vector-im/compound-design-tokens/assets/web/icons/chat";
import RoomIcon from "@vector-im/compound-design-tokens/assets/web/icons/room";
import VideoCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/video-call";

import { _t } from "../../utils/i18n";

/**
 * Props for ComposeMenu component
 */
export interface ComposeMenuProps {
    /** Whether the user can create rooms */
    canCreateRoom: boolean;
    /** Whether the user can create video rooms */
    canCreateVideoRoom: boolean;
    /** Create a chat room */
    createChatRoom: () => void;
    /** Create a room */
    createRoom: () => void;
    /** Create a video room */
    createVideoRoom: () => void;
}

/**
 * @deprecated Use ComposeMenuProps instead
 */
export type ComposeMenuSnapshot = ComposeMenuProps;

/**
 * The compose menu for the room list header.
 * Displays a dropdown menu with options to create new chats, rooms, and video rooms.
 */
export const ComposeMenu: React.FC<ComposeMenuProps> = ({
    canCreateRoom,
    canCreateVideoRoom,
    createChatRoom,
    createRoom,
    createVideoRoom,
}): JSX.Element => {
    const [open, setOpen] = useState(false);

    return (
        <Menu
            open={open}
            onOpenChange={setOpen}
            showTitle={false}
            title={_t("action|open_menu")}
            side="right"
            align="start"
            trigger={
                <IconButton tooltip={_t("action|new_conversation")}>
                    <ComposeIcon color="var(--cpd-color-icon-secondary)" aria-hidden />
                </IconButton>
            }
        >
            <MenuItem Icon={ChatIcon} label={_t("action|start_chat")} onSelect={createChatRoom} hideChevron={true} />
            {canCreateRoom && (
                <MenuItem Icon={RoomIcon} label={_t("action|new_room")} onSelect={createRoom} hideChevron={true} />
            )}
            {canCreateVideoRoom && (
                <MenuItem
                    Icon={VideoCallIcon}
                    label={_t("action|new_video_room")}
                    onSelect={createVideoRoom}
                    hideChevron={true}
                />
            )}
        </Menu>
    );
};
