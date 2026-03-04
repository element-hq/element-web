/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useState, type JSX } from "react";
import { IconButton, Menu, MenuItem } from "@vector-im/compound-web";
import ComposeIcon from "@vector-im/compound-design-tokens/assets/web/icons/compose";
import VideoCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/video-call";
import ChatIcon from "@vector-im/compound-design-tokens/assets/web/icons/chat";
import RoomIcon from "@vector-im/compound-design-tokens/assets/web/icons/room";

import { type RoomListHeaderViewModel } from "../RoomListHeaderView";
import { useI18n } from "../../../utils/i18nContext";
import { useViewModel } from "../../../viewmodel";

interface ComposeMenuViewProps {
    /**
     * The view model for the room list header
     */
    vm: RoomListHeaderViewModel;
}

/**
 * A menu component that provides options for creating new conversations.
 * Displays a dropdown menu with options to start a chat, create a room, or create a video room.
 *
 * @example
 * ```tsx
 * <ComposeMenuView vm={roomListHeaderViewModel} />
 * ```
 */
export function ComposeMenuView({ vm }: ComposeMenuViewProps): JSX.Element {
    const { translate: _t } = useI18n();
    const [open, setOpen] = useState(false);
    const { canCreateRoom, canCreateVideoRoom } = useViewModel(vm);

    return (
        <Menu
            open={open}
            onOpenChange={setOpen}
            showTitle={false}
            title={_t("action|open_menu")}
            align="start"
            trigger={
                // 28px button with a 20px icon
                <IconButton size="28px" style={{ padding: "4px" }} tooltip={_t("action|new_conversation")}>
                    <ComposeIcon aria-hidden />
                </IconButton>
            }
        >
            <MenuItem Icon={ChatIcon} label={_t("action|start_chat")} onSelect={vm.createChatRoom} hideChevron />
            {canCreateRoom && (
                <MenuItem Icon={RoomIcon} label={_t("action|new_room")} onSelect={vm.createRoom} hideChevron />
            )}
            {canCreateVideoRoom && (
                <MenuItem
                    Icon={VideoCallIcon}
                    label={_t("action|new_video_room")}
                    onSelect={vm.createVideoRoom}
                    hideChevron
                />
            )}
        </Menu>
    );
}
