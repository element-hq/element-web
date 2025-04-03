/*
Copyright 2024, 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ChangeEvent, type SyntheticEvent, useContext, useEffect, useRef, useState } from "react";
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
import { EventType, JoinRule, type Room, RoomStateEvent } from "matrix-js-sdk/src/matrix";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useIsEncrypted } from "../../../hooks/useIsEncrypted";
import BaseCard from "./BaseCard";
import { _t } from "../../../languageHandler";
import RoomAvatar from "../avatars/RoomAvatar";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import Modal from "../../../Modal";
import { ShareDialog } from "../dialogs/ShareDialog";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { E2EStatus } from "../../../utils/ShieldUtils";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { TimelineRenderingType } from "../../../contexts/RoomContext";
import RoomName from "../elements/RoomName";
import ExportDialog from "../dialogs/ExportDialog";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import PosthogTrackers from "../../../PosthogTrackers";
import { PollHistoryDialog } from "../dialogs/PollHistoryDialog";
import { Flex } from "../../utils/Flex";
import RoomListStore, { LISTS_UPDATE_EVENT } from "../../../stores/room-list/RoomListStore";
import { DefaultTagID } from "../../../stores/room-list/models";
import { tagRoom } from "../../../utils/room/tagRoom";
import { canInviteTo } from "../../../utils/room/canInviteTo";
import { inviteToRoom } from "../../../utils/room/inviteToRoom";
import { useAccountData } from "../../../hooks/useAccountData";
import { useRoomState } from "../../../hooks/useRoomState";
import { useTopic } from "../../../hooks/room/useTopic";
import { Linkify, topicToHtml } from "../../../HtmlUtils";
import { Box } from "../../utils/Box";
import { onRoomTopicLinkClick } from "../elements/RoomTopic";
import { useDispatcher } from "../../../hooks/useDispatcher";
import { Action } from "../../../dispatcher/actions";
import { Key } from "../../../Keyboard";
import { useTransition } from "../../../hooks/useTransition";
import { isVideoRoom as calcIsVideoRoom } from "../../../utils/video-rooms";
import { usePinnedEvents } from "../../../hooks/usePinnedEvents";
import { ReleaseAnnouncement } from "../../structures/ReleaseAnnouncement.tsx";
import { useScopedRoomContext } from "../../../contexts/ScopedRoomContext.tsx";
import { ReportRoomDialog } from "../dialogs/ReportRoomDialog.tsx";

interface IProps {
    room: Room;
    permalinkCreator: RoomPermalinkCreator;
    onSearchChange?: (e: ChangeEvent) => void;
    onSearchCancel?: () => void;
    focusRoomSearch?: boolean;
}

const onRoomMembersClick = (): void => {
    RightPanelStore.instance.pushCard({ phase: RightPanelPhases.MemberList }, true);
};

const onRoomThreadsClick = (): void => {
    RightPanelStore.instance.pushCard({ phase: RightPanelPhases.ThreadPanel }, true);
};

const onRoomFilesClick = (): void => {
    RightPanelStore.instance.pushCard({ phase: RightPanelPhases.FilePanel }, true);
};

const onRoomExtensionsClick = (): void => {
    RightPanelStore.instance.pushCard({ phase: RightPanelPhases.Extensions }, true);
};

const onRoomPinsClick = (): void => {
    PosthogTrackers.trackInteraction("PinnedMessageRoomInfoButton");
    RightPanelStore.instance.pushCard({ phase: RightPanelPhases.PinnedMessages }, true);
};

const onRoomSettingsClick = (ev: Event): void => {
    defaultDispatcher.dispatch({ action: "open_room_settings" });
    PosthogTrackers.trackInteraction("WebRightPanelRoomInfoSettingsButton", ev);
};

const RoomTopic: React.FC<Pick<IProps, "room">> = ({ room }): JSX.Element | null => {
    const [expanded, setExpanded] = useState(true);

    const topic = useTopic(room);
    const body = topicToHtml(topic?.text, topic?.html);

    const canEditTopic = useRoomState(room, (state) =>
        state.maySendStateEvent(EventType.RoomTopic, room.client.getSafeUserId()),
    );
    const onEditClick = (e: SyntheticEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        defaultDispatcher.dispatch({ action: "open_room_settings" });
    };

    if (!body && !canEditTopic) {
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
                <Box flex="1">
                    <Link kind="primary" onClick={onEditClick}>
                        <Text size="sm" weight="regular">
                            {_t("right_panel|add_topic")}
                        </Text>
                    </Link>
                </Box>
            </Flex>
        );
    }

    const content = expanded ? <Linkify>{body}</Linkify> : body;
    return (
        <Flex
            as="section"
            direction="column"
            justify="center"
            gap="var(--cpd-space-2x)"
            className={classNames("mx_RoomSummaryCard_topic", {
                mx_RoomSummaryCard_topic_collapsed: !expanded,
            })}
        >
            <Box flex="1" className="mx_RoomSummaryCard_topic_container">
                <Text
                    size="sm"
                    weight="regular"
                    onClick={(ev: React.MouseEvent): void => {
                        if (ev.target instanceof HTMLAnchorElement) {
                            onRoomTopicLinkClick(ev);
                            return;
                        }
                    }}
                >
                    {content}
                </Text>
                <IconButton
                    className="mx_RoomSummaryCard_topic_chevron"
                    size="24px"
                    onClick={() => setExpanded(!expanded)}
                >
                    <ChevronDownIcon />
                </IconButton>
            </Box>
            {expanded && canEditTopic && (
                <Box flex="1" className="mx_RoomSummaryCard_topic_edit">
                    <Link kind="primary" onClick={onEditClick}>
                        <Text size="sm" weight="regular">
                            {_t("action|edit")}
                        </Text>
                    </Link>
                </Box>
            )}
        </Flex>
    );
};

const RoomSummaryCard: React.FC<IProps> = ({
    room,
    permalinkCreator,
    onSearchChange,
    onSearchCancel,
    focusRoomSearch,
}) => {
    const cli = useContext(MatrixClientContext);

    const onShareRoomClick = (): void => {
        Modal.createDialog(ShareDialog, {
            target: room,
        });
    };

    const onRoomExportClick = async (): Promise<void> => {
        Modal.createDialog(ExportDialog, {
            room,
        });
    };

    const onRoomPollHistoryClick = (): void => {
        Modal.createDialog(PollHistoryDialog, {
            room,
            matrixClient: cli,
            permalinkCreator,
        });
    };

    const onLeaveRoomClick = (): void => {
        defaultDispatcher.dispatch({
            action: "leave_room",
            room_id: room.roomId,
        });
    };
    const onReportRoomClick = async (): Promise<void> => {
        const [leave] = await Modal.createDialog(ReportRoomDialog, {
            roomId: room.roomId,
        }).finished;
        if (leave) {
            defaultDispatcher.dispatch({
                action: "leave_room",
                room_id: room.roomId,
            });
        }
    };

    const isRoomEncrypted = useIsEncrypted(cli, room);
    const roomContext = useScopedRoomContext("e2eStatus", "timelineRenderingType");
    const e2eStatus = roomContext.e2eStatus;
    const isVideoRoom = calcIsVideoRoom(room);

    const roomState = useRoomState(room);
    const directRoomsList = useAccountData<Record<string, string[]>>(room.client, EventType.Direct);
    const [isDirectMessage, setDirectMessage] = useState(false);
    useEffect(() => {
        for (const [, dmRoomList] of Object.entries(directRoomsList)) {
            if (dmRoomList.includes(room?.roomId ?? "")) {
                setDirectMessage(true);
                break;
            }
        }
    }, [room, directRoomsList]);

    const searchInputRef = useRef<HTMLInputElement>(null);
    useDispatcher(defaultDispatcher, (payload) => {
        if (payload.action === Action.FocusMessageSearch) {
            searchInputRef.current?.focus();
        }
    });
    // Clear the search field when the user leaves the search view
    useTransition(
        (prevTimelineRenderingType) => {
            if (
                prevTimelineRenderingType === TimelineRenderingType.Search &&
                roomContext.timelineRenderingType !== TimelineRenderingType.Search &&
                searchInputRef.current
            ) {
                searchInputRef.current.value = "";
            }
        },
        [roomContext.timelineRenderingType],
    );

    const alias = room.getCanonicalAlias() || room.getAltAliases()[0] || "";
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
                title={alias}
            >
                {alias}
            </Text>

            <Flex as="section" justify="center" gap="var(--cpd-space-2x)" className="mx_RoomSummaryCard_badges">
                {!isDirectMessage && roomState.getJoinRule() === JoinRule.Public && (
                    <Badge kind="grey">
                        <PublicIcon width="1em" />
                        {_t("common|public_room")}
                    </Badge>
                )}

                {isRoomEncrypted && e2eStatus !== E2EStatus.Warning && (
                    <Badge kind="green">
                        <LockIcon width="1em" />
                        {_t("common|encrypted")}
                    </Badge>
                )}

                {!e2eStatus && (
                    <Badge kind="grey">
                        <LockOffIcon width="1em" />
                        {_t("common|unencrypted")}
                    </Badge>
                )}

                {e2eStatus === E2EStatus.Warning && (
                    <Badge kind="red">
                        <ErrorSolidIcon width="1em" />
                        {_t("common|not_trusted")}
                    </Badge>
                )}
            </Flex>

            <RoomTopic room={room} />
        </header>
    );

    const pinCount = usePinnedEvents(room).length;

    const roomTags = useEventEmitterState(RoomListStore.instance, LISTS_UPDATE_EVENT, () =>
        RoomListStore.instance.getTagsForRoom(room),
    );
    const canInviteToState = useEventEmitterState(room, RoomStateEvent.Update, () => canInviteTo(room));
    const isFavorite = roomTags.includes(DefaultTagID.Favourite);

    const header = onSearchChange && (
        <Form.Root className="mx_RoomSummaryCard_search" onSubmit={(e) => e.preventDefault()}>
            <Search
                placeholder={_t("room|search|placeholder")}
                name="room_message_search"
                onChange={onSearchChange}
                className="mx_no_textinput"
                ref={searchInputRef}
                autoFocus={focusRoomSearch}
                onKeyDown={(e) => {
                    if (searchInputRef.current && e.key === Key.ESCAPE) {
                        searchInputRef.current.value = "";
                        onSearchCancel?.();
                    }
                }}
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
                    checked={isFavorite}
                    onSelect={() => tagRoom(room, DefaultTagID.Favourite)}
                />
                <MenuItem
                    Icon={UserAddIcon}
                    label={_t("action|invite")}
                    disabled={!canInviteToState}
                    onSelect={() => inviteToRoom(room)}
                />

                <Separator />

                <MenuItem Icon={UserProfileIcon} label={_t("common|people")} onSelect={onRoomMembersClick} />
                <MenuItem Icon={ThreadsIcon} label={_t("common|threads")} onSelect={onRoomThreadsClick} />
                {!isVideoRoom && (
                    <>
                        <ReleaseAnnouncement
                            feature="pinningMessageList"
                            header={_t("right_panel|pinned_messages|release_announcement|title")}
                            description={_t("right_panel|pinned_messages|release_announcement|description")}
                            closeLabel={_t("right_panel|pinned_messages|release_announcement|close")}
                            placement="top"
                        >
                            <div>
                                <MenuItem
                                    Icon={PinIcon}
                                    label={_t("right_panel|pinned_messages_button")}
                                    onSelect={onRoomPinsClick}
                                >
                                    <Text as="span" size="sm">
                                        {pinCount}
                                    </Text>
                                </MenuItem>
                            </div>
                        </ReleaseAnnouncement>
                        <MenuItem Icon={FilesIcon} label={_t("right_panel|files_button")} onSelect={onRoomFilesClick} />
                        <MenuItem
                            Icon={ExtensionsIcon}
                            label={_t("right_panel|extensions_button")}
                            onSelect={onRoomExtensionsClick}
                        />
                    </>
                )}

                <Separator />

                <MenuItem Icon={LinkIcon} label={_t("action|copy_link")} onSelect={onShareRoomClick} />

                {!isVideoRoom && (
                    <>
                        <MenuItem
                            Icon={PollsIcon}
                            label={_t("right_panel|polls_button")}
                            onSelect={onRoomPollHistoryClick}
                        />
                        <MenuItem
                            Icon={ExportArchiveIcon}
                            label={_t("export_chat|title")}
                            onSelect={onRoomExportClick}
                        />
                    </>
                )}

                <MenuItem Icon={SettingsIcon} label={_t("common|settings")} onSelect={onRoomSettingsClick} />

                <Separator />
                <div className="mx_RoomSummaryCard_bottomOptions">
                    <MenuItem
                        Icon={ErrorIcon}
                        kind="critical"
                        label={_t("action|report_room")}
                        onSelect={onReportRoomClick}
                    />
                    <MenuItem
                        className="mx_RoomSummaryCard_leave"
                        Icon={LeaveIcon}
                        kind="critical"
                        label={_t("action|leave_room")}
                        onSelect={onLeaveRoomClick}
                    />
                </div>
            </div>
        </BaseCard>
    );
};

export default RoomSummaryCard;
