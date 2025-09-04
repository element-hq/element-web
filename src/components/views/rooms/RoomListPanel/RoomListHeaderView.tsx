/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import React, { type JSX, useState } from "react";
import { IconButton, Menu, MenuItem } from "@vector-im/compound-web";
import ComposeIcon from "@vector-im/compound-design-tokens/assets/web/icons/compose";
import UserAddIcon from "@vector-im/compound-design-tokens/assets/web/icons/user-add";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";
import RoomIcon from "@vector-im/compound-design-tokens/assets/web/icons/room";
import HomeIcon from "@vector-im/compound-design-tokens/assets/web/icons/home";
import PreferencesIcon from "@vector-im/compound-design-tokens/assets/web/icons/preferences";
import SettingsIcon from "@vector-im/compound-design-tokens/assets/web/icons/settings";
import VideoCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/video-call";
import ChatIcon from "@vector-im/compound-design-tokens/assets/web/icons/chat";

import { _t } from "../../../../languageHandler";
import { Flex } from "../../../../shared-components/utils/Flex";
import {
    type RoomListHeaderViewState,
    useRoomListHeaderViewModel,
} from "../../../viewmodels/roomlist/RoomListHeaderViewModel";
import { RoomListOptionsMenu } from "./RoomListOptionsMenu";
import { ReleaseAnnouncement } from "../../../structures/ReleaseAnnouncement";

/**
 * The header view for the room list
 * The space name is displayed and a compose menu is shown if the user can create rooms
 */
export function RoomListHeaderView(): JSX.Element {
    const vm = useRoomListHeaderViewModel();

    return (
        <Flex
            as="header"
            className="mx_RoomListHeaderView"
            aria-label={_t("room|context_menu|title")}
            justify="space-between"
            align="center"
            data-testid="room-list-header"
        >
            <Flex className="mx_RoomListHeaderView_title" align="center" gap="var(--cpd-space-1x)">
                <h1 title={vm.title}>{vm.title}</h1>
                {vm.displaySpaceMenu && <SpaceMenu vm={vm} />}
            </Flex>
            <Flex align="center" gap="var(--cpd-space-2x)">
                <ReleaseAnnouncement
                    feature="newRoomList_sort"
                    header={_t("room_list|release_announcement|sort|title")}
                    description={_t("room_list|release_announcement|sort|description")}
                    closeLabel={_t("room_list|release_announcement|next")}
                    placement="bottom"
                >
                    <div className="mx_RoomListHeaderView_ReleaseAnnouncementAnchor">
                        <RoomListOptionsMenu vm={vm} />
                    </div>
                </ReleaseAnnouncement>

                {/* If we don't display the compose menu, it means that the user can only send DM */}
                <ReleaseAnnouncement
                    feature="newRoomList_intro"
                    header={_t("room_list|release_announcement|intro|title")}
                    description={_t("room_list|release_announcement|intro|description")}
                    closeLabel={_t("room_list|release_announcement|next")}
                >
                    <div className="mx_RoomListHeaderView_ReleaseAnnouncementAnchor">
                        {vm.displayComposeMenu ? (
                            <ComposeMenu vm={vm} />
                        ) : (
                            <IconButton
                                aria-label={_t("action|start_chat")}
                                onClick={(e) => vm.createChatRoom(e.nativeEvent)}
                            >
                                <ComposeIcon color="var(--cpd-color-icon-secondary)" />
                            </IconButton>
                        )}
                    </div>
                </ReleaseAnnouncement>
            </Flex>
        </Flex>
    );
}

interface SpaceMenuProps {
    /**
     * The view model for the room list header
     */
    vm: RoomListHeaderViewState;
}

/**
 * The space menu for the room list header
 */
function SpaceMenu({ vm }: SpaceMenuProps): JSX.Element {
    const [open, setOpen] = useState(false);

    return (
        <Menu
            open={open}
            onOpenChange={setOpen}
            title={vm.title}
            side="right"
            align="start"
            trigger={
                <IconButton className="mx_SpaceMenu_button" aria-label={_t("room_list|open_space_menu")} size="20px">
                    <ChevronDownIcon color="var(--cpd-color-icon-secondary)" />
                </IconButton>
            }
        >
            <MenuItem
                Icon={HomeIcon}
                label={_t("room_list|space_menu|home")}
                onSelect={vm.openSpaceHome}
                hideChevron={true}
            />
            {vm.canInviteInSpace && (
                <MenuItem
                    Icon={UserAddIcon}
                    label={_t("action|invite")}
                    onSelect={vm.inviteInSpace}
                    hideChevron={true}
                />
            )}
            <MenuItem
                Icon={PreferencesIcon}
                label={_t("common|preferences")}
                onSelect={vm.openSpacePreferences}
                hideChevron={true}
            />
            {vm.canAccessSpaceSettings && (
                <MenuItem
                    Icon={SettingsIcon}
                    label={_t("room_list|space_menu|space_settings")}
                    onSelect={vm.openSpaceSettings}
                    hideChevron={true}
                />
            )}
        </Menu>
    );
}

interface ComposeMenuProps {
    /**
     * The view model for the room list header
     */
    vm: RoomListHeaderViewState;
}

/**
 * The compose menu for the room list header
 */
function ComposeMenu({ vm }: ComposeMenuProps): JSX.Element {
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
                <IconButton aria-label={_t("action|add")}>
                    <ComposeIcon color="var(--cpd-color-icon-secondary)" />
                </IconButton>
            }
        >
            <MenuItem Icon={ChatIcon} label={_t("action|start_chat")} onSelect={vm.createChatRoom} hideChevron={true} />
            {vm.canCreateRoom && (
                <MenuItem Icon={RoomIcon} label={_t("action|new_room")} onSelect={vm.createRoom} hideChevron={true} />
            )}
            {vm.canCreateVideoRoom && (
                <MenuItem
                    Icon={VideoCallIcon}
                    label={_t("action|new_video_room")}
                    onSelect={vm.createVideoRoom}
                    hideChevron={true}
                />
            )}
        </Menu>
    );
}
