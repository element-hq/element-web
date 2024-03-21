/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import classNames from "classnames";
import { MenuItem, Tooltip, Separator, ToggleMenuItem, Text, Badge, Heading } from "@vector-im/compound-web";
import { Icon as SearchIcon } from "@vector-im/compound-design-tokens/icons/search.svg";
import { Icon as FavouriteIcon } from "@vector-im/compound-design-tokens/icons/favourite.svg";
import { Icon as UserAddIcon } from "@vector-im/compound-design-tokens/icons/user-add.svg";
import { Icon as UserProfileSolidIcon } from "@vector-im/compound-design-tokens/icons/user-profile-solid.svg";
import { Icon as LinkIcon } from "@vector-im/compound-design-tokens/icons/link.svg";
import { Icon as SettingsIcon } from "@vector-im/compound-design-tokens/icons/settings.svg";
import { Icon as ExportArchiveIcon } from "@vector-im/compound-design-tokens/icons/export-archive.svg";
import { Icon as LeaveIcon } from "@vector-im/compound-design-tokens/icons/leave.svg";
import { Icon as FilesIcon } from "@vector-im/compound-design-tokens/icons/files.svg";
import { Icon as PollsIcon } from "@vector-im/compound-design-tokens/icons/polls.svg";
import { Icon as PinIcon } from "@vector-im/compound-design-tokens/icons/pin.svg";
import { Icon as LockIcon } from "@vector-im/compound-design-tokens/icons/lock-solid.svg";
import { Icon as LockOffIcon } from "@vector-im/compound-design-tokens/icons/lock-off.svg";
import { Icon as PublicIcon } from "@vector-im/compound-design-tokens/icons/public.svg";
import { Icon as ErrorIcon } from "@vector-im/compound-design-tokens/icons/error.svg";
import { EventType, JoinRule, Room } from "matrix-js-sdk/src/matrix";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useIsEncrypted } from "../../../hooks/useIsEncrypted";
import BaseCard, { Group } from "./BaseCard";
import { _t } from "../../../languageHandler";
import RoomAvatar from "../avatars/RoomAvatar";
import AccessibleButton from "../elements/AccessibleButton";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import Modal from "../../../Modal";
import ShareDialog from "../dialogs/ShareDialog";
import { useEventEmitter, useEventEmitterState } from "../../../hooks/useEventEmitter";
import WidgetUtils from "../../../utils/WidgetUtils";
import { IntegrationManagers } from "../../../integrations/IntegrationManagers";
import SettingsStore from "../../../settings/SettingsStore";
import WidgetAvatar from "../avatars/WidgetAvatar";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import WidgetStore, { IApp } from "../../../stores/WidgetStore";
import { E2EStatus } from "../../../utils/ShieldUtils";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import RoomContext from "../../../contexts/RoomContext";
import { UIComponent, UIFeature } from "../../../settings/UIFeature";
import { ChevronFace, ContextMenuTooltipButton, useContextMenu } from "../../structures/ContextMenu";
import { WidgetContextMenu } from "../context_menus/WidgetContextMenu";
import { useFeatureEnabled } from "../../../hooks/useSettings";
import { usePinnedEvents } from "./PinnedMessagesCard";
import { Container, MAX_PINNED, WidgetLayoutStore } from "../../../stores/widgets/WidgetLayoutStore";
import RoomName from "../elements/RoomName";
import UIStore from "../../../stores/UIStore";
import ExportDialog from "../dialogs/ExportDialog";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import PosthogTrackers from "../../../PosthogTrackers";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { PollHistoryDialog } from "../dialogs/PollHistoryDialog";
import { Flex } from "../../utils/Flex";
import RoomListStore, { LISTS_UPDATE_EVENT } from "../../../stores/room-list/RoomListStore";
import { DefaultTagID } from "../../../stores/room-list/models";
import { tagRoom } from "../../../utils/room/tagRoom";
import { canInviteTo } from "../../../utils/room/canInviteTo";
import { inviteToRoom } from "../../../utils/room/inviteToRoom";
import { useAccountData } from "../../../hooks/useAccountData";
import { useRoomState } from "../../../hooks/useRoomState";

interface IProps {
    room: Room;
    permalinkCreator: RoomPermalinkCreator;
    onClose(): void;
    onSearchClick?: () => void;
}

interface IAppsSectionProps {
    room: Room;
}

export const useWidgets = (room: Room): IApp[] => {
    const [apps, setApps] = useState<IApp[]>(() => WidgetStore.instance.getApps(room.roomId));

    const updateApps = useCallback(() => {
        // Copy the array so that we always trigger a re-render, as some updates mutate the array of apps/settings
        setApps([...WidgetStore.instance.getApps(room.roomId)]);
    }, [room]);

    useEffect(updateApps, [room, updateApps]);
    useEventEmitter(WidgetStore.instance, room.roomId, updateApps);
    useEventEmitter(WidgetLayoutStore.instance, WidgetLayoutStore.emissionForRoom(room), updateApps);

    return apps;
};

interface IAppRowProps {
    app: IApp;
    room: Room;
}

const AppRow: React.FC<IAppRowProps> = ({ app, room }) => {
    const name = WidgetUtils.getWidgetName(app);
    const dataTitle = WidgetUtils.getWidgetDataTitle(app);
    const subtitle = dataTitle && " - " + dataTitle;
    const [canModifyWidget, setCanModifyWidget] = useState<boolean>();

    useEffect(() => {
        setCanModifyWidget(WidgetUtils.canUserModifyWidgets(room.client, room.roomId));
    }, [room.client, room.roomId]);

    const onOpenWidgetClick = (): void => {
        RightPanelStore.instance.pushCard({
            phase: RightPanelPhases.Widget,
            state: { widgetId: app.id },
        });
    };

    const isPinned = WidgetLayoutStore.instance.isInContainer(room, app, Container.Top);
    const togglePin = isPinned
        ? () => {
              WidgetLayoutStore.instance.moveToContainer(room, app, Container.Right);
          }
        : () => {
              WidgetLayoutStore.instance.moveToContainer(room, app, Container.Top);
          };

    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu<HTMLDivElement>();
    let contextMenu;
    if (menuDisplayed) {
        const rect = handle.current?.getBoundingClientRect();
        const rightMargin = rect?.right ?? 0;
        const topMargin = rect?.top ?? 0;
        contextMenu = (
            <WidgetContextMenu
                chevronFace={ChevronFace.None}
                right={UIStore.instance.windowWidth - rightMargin}
                bottom={UIStore.instance.windowHeight - topMargin}
                onFinished={closeMenu}
                app={app}
            />
        );
    }

    const cannotPin = !isPinned && !WidgetLayoutStore.instance.canAddToContainer(room, Container.Top);

    let pinTitle: string;
    if (cannotPin) {
        pinTitle = _t("right_panel|pinned_messages|limits", { count: MAX_PINNED });
    } else {
        pinTitle = isPinned ? _t("action|unpin") : _t("action|pin");
    }

    const isMaximised = WidgetLayoutStore.instance.isInContainer(room, app, Container.Center);
    const toggleMaximised = isMaximised
        ? () => {
              WidgetLayoutStore.instance.moveToContainer(room, app, Container.Right);
          }
        : () => {
              WidgetLayoutStore.instance.moveToContainer(room, app, Container.Center);
          };

    const maximiseTitle = isMaximised ? _t("action|close") : _t("action|maximise");

    let openTitle = "";
    if (isPinned) {
        openTitle = _t("widget|unpin_to_view_right_panel");
    } else if (isMaximised) {
        openTitle = _t("widget|close_to_view_right_panel");
    }

    const classes = classNames("mx_BaseCard_Button mx_RoomSummaryCard_Button", {
        mx_RoomSummaryCard_Button_pinned: isPinned,
        mx_RoomSummaryCard_Button_maximised: isMaximised,
    });

    return (
        <div className={classes} ref={handle}>
            <AccessibleTooltipButton
                className="mx_RoomSummaryCard_icon_app"
                onClick={onOpenWidgetClick}
                // only show a tooltip if the widget is pinned
                title={openTitle}
                forceHide={!(isPinned || isMaximised)}
                disabled={isPinned || isMaximised}
            >
                <WidgetAvatar app={app} size="20px" />
                <span>{name}</span>
                {subtitle}
            </AccessibleTooltipButton>

            {canModifyWidget && (
                <ContextMenuTooltipButton
                    className="mx_RoomSummaryCard_app_options"
                    isExpanded={menuDisplayed}
                    onClick={openMenu}
                    title={_t("common|options")}
                />
            )}

            <AccessibleTooltipButton
                className="mx_RoomSummaryCard_app_pinToggle"
                onClick={togglePin}
                title={pinTitle}
                disabled={cannotPin}
            />
            <AccessibleTooltipButton
                className="mx_RoomSummaryCard_app_maximiseToggle"
                onClick={toggleMaximised}
                title={maximiseTitle}
            />

            {contextMenu}
        </div>
    );
};

const AppsSection: React.FC<IAppsSectionProps> = ({ room }) => {
    const apps = useWidgets(room);
    // Filter out virtual widgets
    const realApps = useMemo(() => apps.filter((app) => app.eventId !== undefined), [apps]);

    const onManageIntegrations = (): void => {
        const managers = IntegrationManagers.sharedInstance();
        if (!managers.hasManager()) {
            managers.openNoManagerDialog();
        } else {
            // noinspection JSIgnoredPromiseFromCall
            managers.getPrimaryManager()?.open(room);
        }
    };

    let copyLayoutBtn: JSX.Element | null = null;
    if (realApps.length > 0 && WidgetLayoutStore.instance.canCopyLayoutToRoom(room)) {
        copyLayoutBtn = (
            <AccessibleButton kind="link" onClick={() => WidgetLayoutStore.instance.copyLayoutToRoom(room)}>
                {_t("widget|set_room_layout")}
            </AccessibleButton>
        );
    }

    return (
        <Group className="mx_RoomSummaryCard_appsGroup" title={_t("right_panel|widgets_section")}>
            {realApps.map((app) => (
                <AppRow key={app.id} app={app} room={room} />
            ))}
            {copyLayoutBtn}
            <AccessibleButton kind="link" onClick={onManageIntegrations}>
                {realApps.length > 0 ? _t("right_panel|edit_integrations") : _t("right_panel|add_integrations")}
            </AccessibleButton>
        </Group>
    );
};

const onRoomFilesClick = (): void => {
    RightPanelStore.instance.pushCard({ phase: RightPanelPhases.FilePanel }, true);
};

const onRoomPinsClick = (): void => {
    RightPanelStore.instance.pushCard({ phase: RightPanelPhases.PinnedMessages }, true);
};

const onRoomSettingsClick = (ev: Event): void => {
    defaultDispatcher.dispatch({ action: "open_room_settings" });
    PosthogTrackers.trackInteraction("WebRightPanelRoomInfoSettingsButton", ev);
};

const RoomSummaryCard: React.FC<IProps> = ({ room, permalinkCreator, onClose, onSearchClick }) => {
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

    const onRoomMembersClick = (ev: Event): void => {
        RightPanelStore.instance.pushCard({ phase: RightPanelPhases.RoomMemberList }, true);
        PosthogTrackers.trackInteraction("WebRightPanelRoomInfoPeopleButton", ev);
    };

    const isRoomEncrypted = useIsEncrypted(cli, room);
    const roomContext = useContext(RoomContext);
    const e2eStatus = roomContext.e2eStatus;
    const videoRoomsEnabled = useFeatureEnabled("feature_video_rooms");
    const elementCallVideoRoomsEnabled = useFeatureEnabled("feature_element_call_video_rooms");
    const isVideoRoom =
        videoRoomsEnabled && (room.isElementVideoRoom() || (elementCallVideoRoomsEnabled && room.isCallRoom()));

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

    const alias = room.getCanonicalAlias() || room.getAltAliases()[0] || "";
    const header = (
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
                    <Badge kind="default">
                        <PublicIcon width="1em" />
                        {_t("common|public_room")}
                    </Badge>
                )}

                {isRoomEncrypted && e2eStatus !== E2EStatus.Warning && (
                    <Badge kind="success">
                        <LockIcon width="1em" />
                        {_t("common|encrypted")}
                    </Badge>
                )}

                {!e2eStatus && (
                    <Badge kind="default">
                        <LockOffIcon width="1em" />
                        {_t("common|unencrypted")}
                    </Badge>
                )}

                {e2eStatus === E2EStatus.Warning && (
                    <Badge kind="critical">
                        <ErrorIcon width="1em" />
                        {_t("common|not_trusted")}
                    </Badge>
                )}
            </Flex>
        </header>
    );

    const pinningEnabled = useFeatureEnabled("feature_pinning");
    const pinCount = usePinnedEvents(pinningEnabled ? room : undefined)?.length;

    const roomTags = useEventEmitterState(RoomListStore.instance, LISTS_UPDATE_EVENT, () =>
        RoomListStore.instance.getTagsForRoom(room),
    );
    const isFavorite = roomTags.includes(DefaultTagID.Favourite);

    return (
        <BaseCard header={null} className="mx_RoomSummaryCard" onClose={onClose}>
            <Flex
                as="header"
                className="mx_RoomSummaryCard_header"
                gap="var(--cpd-space-3x)"
                align="center"
                justify="space-between"
            >
                <Tooltip label={_t("action|search")} side="right">
                    <button
                        className="mx_RoomSummaryCard_searchBtn"
                        data-testid="summary-search"
                        onClick={() => {
                            onSearchClick?.();
                        }}
                        aria-label={_t("action|search")}
                    >
                        <SearchIcon width="100%" height="100%" />
                    </button>
                </Tooltip>
                <AccessibleButton
                    data-testid="base-card-close-button"
                    className="mx_BaseCard_close"
                    onClick={onClose}
                    title={_t("action|close")}
                />
            </Flex>

            {header}

            <Separator />

            <ToggleMenuItem
                Icon={FavouriteIcon}
                label={_t("room|context_menu|favourite")}
                checked={isFavorite}
                onChange={() => tagRoom(room, DefaultTagID.Favourite)}
                // XXX: https://github.com/element-hq/compound/issues/288
                onSelect={() => {}}
            />
            <MenuItem
                Icon={UserAddIcon}
                label={_t("action|invite")}
                disabled={!canInviteTo(room)}
                onSelect={() => inviteToRoom(room)}
            />
            <MenuItem Icon={LinkIcon} label={_t("action|copy_link")} onSelect={onShareRoomClick} />
            <MenuItem Icon={SettingsIcon} label={_t("common|settings")} onSelect={onRoomSettingsClick} />

            <Separator />
            <MenuItem
                // this icon matches the legacy implementation
                // and is a short term solution until legacy room header is removed
                Icon={UserProfileSolidIcon}
                label={_t("common|people")}
                onSelect={onRoomMembersClick}
            />
            {!isVideoRoom && (
                <>
                    <MenuItem Icon={FilesIcon} label={_t("right_panel|files_button")} onSelect={onRoomFilesClick} />
                    <MenuItem
                        Icon={PollsIcon}
                        label={_t("right_panel|polls_button")}
                        onSelect={onRoomPollHistoryClick}
                    />
                    {pinningEnabled && (
                        <MenuItem
                            Icon={PinIcon}
                            label={_t("right_panel|pinned_messages_button")}
                            onSelect={onRoomPinsClick}
                        >
                            <Text as="span" size="sm">
                                {pinCount}
                            </Text>
                        </MenuItem>
                    )}
                    <MenuItem Icon={ExportArchiveIcon} label={_t("export_chat|title")} onSelect={onRoomExportClick} />
                </>
            )}

            <Separator />

            <MenuItem Icon={LeaveIcon} kind="critical" label={_t("action|leave_room")} onSelect={onLeaveRoomClick} />

            {SettingsStore.getValue(UIFeature.Widgets) &&
                !isVideoRoom &&
                shouldShowComponent(UIComponent.AddIntegrations) && <AppsSection room={room} />}
        </BaseCard>
    );
};

export default RoomSummaryCard;
