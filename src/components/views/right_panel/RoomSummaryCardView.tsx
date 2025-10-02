/*
Copyright 2024, 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useState, type JSX } from "react";
import classNames from "classnames";
import {
    MenuItem,
    Separator,
    ToggleMenuItem,
    Text,
    Badge,
    Heading,
    IconButton,
    Link,
    Search,
    Form,
} from "@vector-im/compound-web";
import FavouriteIcon from "@vector-im/compound-design-tokens/assets/web/icons/favourite";
import UserAddIcon from "@vector-im/compound-design-tokens/assets/web/icons/user-add";
import LinkIcon from "@vector-im/compound-design-tokens/assets/web/icons/link";
import SettingsIcon from "@vector-im/compound-design-tokens/assets/web/icons/settings";
import ExportArchiveIcon from "@vector-im/compound-design-tokens/assets/web/icons/export-archive";
import LeaveIcon from "@vector-im/compound-design-tokens/assets/web/icons/leave";
import FilesIcon from "@vector-im/compound-design-tokens/assets/web/icons/files";
import ExtensionsIcon from "@vector-im/compound-design-tokens/assets/web/icons/extensions";
import UserProfileIcon from "@vector-im/compound-design-tokens/assets/web/icons/user-profile";
import ThreadsIcon from "@vector-im/compound-design-tokens/assets/web/icons/threads";
import PollsIcon from "@vector-im/compound-design-tokens/assets/web/icons/polls";
import PinIcon from "@vector-im/compound-design-tokens/assets/web/icons/pin";
import LockIcon from "@vector-im/compound-design-tokens/assets/web/icons/lock-solid";
import LockOffIcon from "@vector-im/compound-design-tokens/assets/web/icons/lock-off";
import PublicIcon from "@vector-im/compound-design-tokens/assets/web/icons/public";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error";
import ErrorSolidIcon from "@vector-im/compound-design-tokens/assets/web/icons/error-solid";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";
import { JoinRule, type Room } from "matrix-js-sdk/src/matrix";

import BaseCard from "./BaseCard.tsx";
import { _t } from "../../../languageHandler.tsx";
import RoomAvatar from "../avatars/RoomAvatar.tsx";
import { E2EStatus } from "../../../utils/ShieldUtils.ts";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks.ts";
import RoomName from "../elements/RoomName.tsx";
import { Flex } from "../../../shared-components/utils/Flex";
import { Linkify, topicToHtml } from "../../../HtmlUtils.tsx";
import { Box } from "../../../shared-components/utils/Box";
import { useRoomSummaryCardViewModel } from "../../viewmodels/right_panel/RoomSummaryCardViewModel.tsx";
import { useRoomTopicViewModel } from "../../viewmodels/right_panel/RoomSummaryCardTopicViewModel.tsx";

interface IProps {
    room: Room;
    permalinkCreator: RoomPermalinkCreator;
    onSearchChange?: (term: string) => void;
    onSearchCancel?: () => void;
    focusRoomSearch?: boolean;
    searchTerm?: string;
}

const RoomTopic: React.FC<Pick<IProps, "room">> = ({ room }): JSX.Element | null => {
    const vm = useRoomTopicViewModel(room);

    const body = topicToHtml(vm.topic?.text, vm.topic?.html);

    if (!body && !vm.canEditTopic) {
        return null;
    }

    if (!body) {
        return (
            <Flex
                as="section"
                direction="column"
                justify="center"
                gap="var(--cpd-space-2x)"
                className="mx_RoomSummaryCard_topic"
            >
                <Box flex="1" className="mx_RoomSummaryCard_topic_box">
                    <Link kind="primary" onClick={vm.onEditClick}>
                        <Text size="sm" weight="regular">
                            {_t("right_panel|add_topic")}
                        </Text>
                    </Link>
                </Box>
            </Flex>
        );
    }

    const content = vm.expanded ? <Linkify>{body}</Linkify> : body;

    return (
        <Flex
            as="section"
            direction="column"
            justify="center"
            gap="var(--cpd-space-2x)"
            className={classNames("mx_RoomSummaryCard_topic", {
                mx_RoomSummaryCard_topic_collapsed: !vm.expanded,
            })}
        >
            <Box flex="1" className="mx_RoomSummaryCard_topic_container mx_RoomSummaryCard_topic_box">
                <Text size="sm" weight="regular" onClick={vm.onTopicLinkClick}>
                    {content}
                </Text>
                <IconButton className="mx_RoomSummaryCard_topic_chevron" size="24px" onClick={vm.onExpandedClick}>
                    <ChevronDownIcon />
                </IconButton>
            </Box>
            {vm.expanded && vm.canEditTopic && (
                <Box flex="1" className="mx_RoomSummaryCard_topic_edit">
                    <Link kind="primary" onClick={vm.onEditClick}>
                        <Text size="sm" weight="regular">
                            {_t("action|edit")}
                        </Text>
                    </Link>
                </Box>
            )}
        </Flex>
    );
};

const RoomSummaryCardView: React.FC<IProps> = ({
    room,
    permalinkCreator,
    onSearchChange,
    onSearchCancel,
    focusRoomSearch,
    searchTerm = "",
}) => {
    const vm = useRoomSummaryCardViewModel(room, permalinkCreator, onSearchCancel);

    // The search field is controlled and onSearchChange is debounced in RoomView,
    // so we need to set the value of the input right away
    const [searchValue, setSearchValue] = useState(searchTerm);
    useEffect(() => {
        setSearchValue(searchTerm);
    }, [searchTerm]);

    const roomInfo = (
        <header className="mx_RoomSummaryCard_container">
            <RoomAvatar room={room} size="80px" viewAvatarOnClick />
            <RoomName room={room}>
                {(name) => (
                    <Heading
                        as="h1"
                        size="md"
                        weight="semibold"
                        className="mx_RoomSummaryCard_roomName text-primary"
                        title={name}
                    >
                        {name}
                    </Heading>
                )}
            </RoomName>
            <Text
                as="div"
                size="sm"
                weight="semibold"
                className="mx_RoomSummaryCard_alias text-secondary"
                title={vm.alias}
            >
                {vm.alias}
            </Text>

            <Flex as="section" justify="center" gap="var(--cpd-space-2x)" className="mx_RoomSummaryCard_badges">
                {!vm.isDirectMessage && vm.roomJoinRule === JoinRule.Public && (
                    <Badge kind="blue">
                        <PublicIcon width="1em" color="var(--cpd-color-icon-info-primary)" />
                        {_t("common|public_room")}
                    </Badge>
                )}

                {vm.isRoomEncrypted && vm.e2eStatus !== E2EStatus.Warning && (
                    <Badge kind="green">
                        <LockIcon width="1em" />
                        {_t("common|encrypted")}
                    </Badge>
                )}

                {!vm.isRoomEncrypted && (
                    <Badge kind="blue">
                        <LockOffIcon width="1em" color="var(--cpd-color-icon-info-primary)" />
                        {_t("common|unencrypted")}
                    </Badge>
                )}

                {vm.e2eStatus === E2EStatus.Warning && (
                    <Badge kind="red">
                        <ErrorSolidIcon width="1em" />
                        {_t("common|not_trusted")}
                    </Badge>
                )}
            </Flex>

            <RoomTopic room={room} />
        </header>
    );

    const header = onSearchChange && (
        <Form.Root className="mx_RoomSummaryCard_search" onSubmit={(e) => e.preventDefault()}>
            <Search
                placeholder={_t("room|search|placeholder")}
                name="room_message_search"
                onChange={(e) => {
                    setSearchValue(e.currentTarget.value);
                    onSearchChange(e.currentTarget.value);
                }}
                value={searchValue}
                className="mx_no_textinput"
                ref={vm.searchInputRef}
                autoFocus={focusRoomSearch}
                onKeyDown={vm.onUpdateSearchInput}
            />
        </Form.Root>
    );

    return (
        <BaseCard
            id="room-summary-panel"
            className="mx_RoomSummaryCard"
            ariaLabelledBy="room-summary-panel-tab"
            role="tabpanel"
            header={header}
        >
            {roomInfo}

            <Separator />

            <div role="menubar" aria-orientation="vertical">
                <ToggleMenuItem
                    Icon={FavouriteIcon}
                    label={_t("room|context_menu|favourite")}
                    checked={vm.isFavorite}
                    onSelect={vm.onFavoriteToggleClick}
                />
                <MenuItem
                    Icon={UserAddIcon}
                    label={_t("action|invite")}
                    disabled={!vm.canInviteToState}
                    onSelect={vm.onInviteToRoomClick}
                />

                <Separator />

                <MenuItem Icon={UserProfileIcon} label={_t("common|people")} onSelect={vm.onRoomMembersClick} />
                <MenuItem Icon={ThreadsIcon} label={_t("common|threads")} onSelect={vm.onRoomThreadsClick} />
                {!vm.isVideoRoom && (
                    <>
                        <MenuItem
                            Icon={PinIcon}
                            label={_t("right_panel|pinned_messages_button")}
                            onSelect={vm.onRoomPinsClick}
                        >
                            <Text as="span" size="sm">
                                {vm.pinCount}
                            </Text>
                        </MenuItem>
                        <MenuItem
                            Icon={FilesIcon}
                            label={_t("right_panel|files_button")}
                            onSelect={vm.onRoomFilesClick}
                        />
                        <MenuItem
                            Icon={ExtensionsIcon}
                            label={_t("right_panel|extensions_button")}
                            onSelect={vm.onRoomExtensionsClick}
                        />
                    </>
                )}

                <Separator />

                <MenuItem Icon={LinkIcon} label={_t("action|copy_link")} onSelect={vm.onShareRoomClick} />

                {!vm.isVideoRoom && (
                    <>
                        <MenuItem
                            Icon={PollsIcon}
                            label={_t("right_panel|polls_button")}
                            onSelect={vm.onRoomPollHistoryClick}
                        />
                        <MenuItem
                            Icon={ExportArchiveIcon}
                            label={_t("export_chat|title")}
                            onSelect={vm.onRoomExportClick}
                        />
                    </>
                )}

                <MenuItem Icon={SettingsIcon} label={_t("common|settings")} onSelect={vm.onRoomSettingsClick} />

                <Separator />
                <div className="mx_RoomSummaryCard_bottomOptions">
                    <MenuItem
                        Icon={ErrorIcon}
                        kind="critical"
                        label={_t("action|report_room")}
                        onSelect={vm.onReportRoomClick}
                    />
                    <MenuItem
                        className="mx_RoomSummaryCard_leave"
                        Icon={LeaveIcon}
                        kind="critical"
                        label={_t("action|leave_room")}
                        onSelect={vm.onLeaveRoomClick}
                    />
                </div>
            </div>
        </BaseCard>
    );
};

export default RoomSummaryCardView;
