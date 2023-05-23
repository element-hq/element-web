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
import { Room } from "matrix-js-sdk/src/models/room";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useIsEncrypted } from "../../../hooks/useIsEncrypted";
import BaseCard, { Group } from "./BaseCard";
import { _t } from "../../../languageHandler";
import RoomAvatar from "../avatars/RoomAvatar";
import AccessibleButton, { ButtonEvent, IAccessibleButtonProps } from "../elements/AccessibleButton";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import Modal from "../../../Modal";
import ShareDialog from "../dialogs/ShareDialog";
import { useEventEmitter } from "../../../hooks/useEventEmitter";
import WidgetUtils from "../../../utils/WidgetUtils";
import { IntegrationManagers } from "../../../integrations/IntegrationManagers";
import SettingsStore from "../../../settings/SettingsStore";
import TextWithTooltip from "../elements/TextWithTooltip";
import WidgetAvatar from "../avatars/WidgetAvatar";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import WidgetStore, { IApp } from "../../../stores/WidgetStore";
import { E2EStatus } from "../../../utils/ShieldUtils";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import RoomContext from "../../../contexts/RoomContext";
import { UIComponent, UIFeature } from "../../../settings/UIFeature";
import { ChevronFace, ContextMenuTooltipButton, useContextMenu } from "../../structures/ContextMenu";
import { WidgetContextMenu } from "../context_menus/WidgetContextMenu";
import { useRoomMemberCount } from "../../../hooks/useRoomMembers";
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

interface IProps {
    room: Room;
    permalinkCreator: RoomPermalinkCreator;
    onClose(): void;
}

interface IAppsSectionProps {
    room: Room;
}

interface IButtonProps extends IAccessibleButtonProps {
    className: string;
    onClick(ev: ButtonEvent): void;
}

const Button: React.FC<IButtonProps> = ({ children, className, onClick, ...props }) => {
    return (
        <AccessibleButton
            {...props}
            className={classNames("mx_BaseCard_Button mx_RoomSummaryCard_Button", className)}
            onClick={onClick}
        >
            {children}
        </AccessibleButton>
    );
};

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
        pinTitle = _t("You can only pin up to %(count)s widgets", { count: MAX_PINNED });
    } else {
        pinTitle = isPinned ? _t("Unpin") : _t("Pin");
    }

    const isMaximised = WidgetLayoutStore.instance.isInContainer(room, app, Container.Center);
    const toggleMaximised = isMaximised
        ? () => {
              WidgetLayoutStore.instance.moveToContainer(room, app, Container.Right);
          }
        : () => {
              WidgetLayoutStore.instance.moveToContainer(room, app, Container.Center);
          };

    const maximiseTitle = isMaximised ? _t("Close") : _t("Maximise");

    let openTitle = "";
    if (isPinned) {
        openTitle = _t("Unpin this widget to view it in this panel");
    } else if (isMaximised) {
        openTitle = _t("Close this widget to view it in this panel");
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
                <WidgetAvatar app={app} />
                <span>{name}</span>
                {subtitle}
            </AccessibleTooltipButton>

            {canModifyWidget && (
                <ContextMenuTooltipButton
                    className="mx_RoomSummaryCard_app_options"
                    isExpanded={menuDisplayed}
                    onClick={openMenu}
                    title={_t("Options")}
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
                {_t("Set my room layout for everyone")}
            </AccessibleButton>
        );
    }

    return (
        <Group className="mx_RoomSummaryCard_appsGroup" title={_t("Widgets")}>
            {realApps.map((app) => (
                <AppRow key={app.id} app={app} room={room} />
            ))}
            {copyLayoutBtn}
            <AccessibleButton kind="link" onClick={onManageIntegrations}>
                {realApps.length > 0 ? _t("Edit widgets, bridges & bots") : _t("Add widgets, bridges & bots")}
            </AccessibleButton>
        </Group>
    );
};

const onRoomMembersClick = (ev: ButtonEvent): void => {
    RightPanelStore.instance.pushCard({ phase: RightPanelPhases.RoomMemberList }, true);
    PosthogTrackers.trackInteraction("WebRightPanelRoomInfoPeopleButton", ev);
};

const onRoomFilesClick = (): void => {
    RightPanelStore.instance.pushCard({ phase: RightPanelPhases.FilePanel }, true);
};

const onRoomPinsClick = (): void => {
    RightPanelStore.instance.pushCard({ phase: RightPanelPhases.PinnedMessages }, true);
};

const onRoomSettingsClick = (ev: ButtonEvent): void => {
    defaultDispatcher.dispatch({ action: "open_room_settings" });
    PosthogTrackers.trackInteraction("WebRightPanelRoomInfoSettingsButton", ev);
};

const RoomSummaryCard: React.FC<IProps> = ({ room, permalinkCreator, onClose }) => {
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

    const isRoomEncrypted = useIsEncrypted(cli, room);
    const roomContext = useContext(RoomContext);
    const e2eStatus = roomContext.e2eStatus;
    const videoRoomsEnabled = useFeatureEnabled("feature_video_rooms");
    const elementCallVideoRoomsEnabled = useFeatureEnabled("feature_element_call_video_rooms");
    const isVideoRoom =
        videoRoomsEnabled && (room.isElementVideoRoom() || (elementCallVideoRoomsEnabled && room.isCallRoom()));

    const alias = room.getCanonicalAlias() || room.getAltAliases()[0] || "";
    const header = (
        <React.Fragment>
            <div className="mx_RoomSummaryCard_avatar" role="presentation">
                <RoomAvatar room={room} height={54} width={54} viewAvatarOnClick />
                <TextWithTooltip
                    tooltip={isRoomEncrypted ? _t("Encrypted") : _t("Not encrypted")}
                    class={classNames("mx_RoomSummaryCard_e2ee", {
                        mx_RoomSummaryCard_e2ee_normal: isRoomEncrypted,
                        mx_RoomSummaryCard_e2ee_warning: isRoomEncrypted && e2eStatus === E2EStatus.Warning,
                        mx_RoomSummaryCard_e2ee_verified: isRoomEncrypted && e2eStatus === E2EStatus.Verified,
                    })}
                />
            </div>

            <RoomName room={room}>
                {(name) => (
                    <h1 className="mx_RoomSummaryCard_roomName" title={name}>
                        {name}
                    </h1>
                )}
            </RoomName>
            <div className="mx_RoomSummaryCard_alias" title={alias}>
                {alias}
            </div>
        </React.Fragment>
    );

    const memberCount = useRoomMemberCount(room);
    const pinningEnabled = useFeatureEnabled("feature_pinning");
    const pinCount = usePinnedEvents(pinningEnabled ? room : undefined)?.length;

    return (
        <BaseCard header={header} className="mx_RoomSummaryCard" onClose={onClose}>
            <Group title={_t("About")} className="mx_RoomSummaryCard_aboutGroup">
                <Button className="mx_RoomSummaryCard_icon_people" onClick={onRoomMembersClick}>
                    {_t("People")}
                    <span className="mx_BaseCard_Button_sublabel">{memberCount}</span>
                </Button>
                {!isVideoRoom && (
                    <Button className="mx_RoomSummaryCard_icon_files" onClick={onRoomFilesClick}>
                        {_t("Files")}
                    </Button>
                )}
                {!isVideoRoom && (
                    <Button className="mx_RoomSummaryCard_icon_poll" onClick={onRoomPollHistoryClick}>
                        {_t("Poll history")}
                    </Button>
                )}
                {pinningEnabled && !isVideoRoom && (
                    <Button className="mx_RoomSummaryCard_icon_pins" onClick={onRoomPinsClick}>
                        {_t("Pinned")}
                        {pinCount > 0 && <span className="mx_BaseCard_Button_sublabel">{pinCount}</span>}
                    </Button>
                )}
                {!isVideoRoom && (
                    <Button className="mx_RoomSummaryCard_icon_export" onClick={onRoomExportClick}>
                        {_t("Export chat")}
                    </Button>
                )}
                <Button
                    data-testid="shareRoomButton"
                    className="mx_RoomSummaryCard_icon_share"
                    onClick={onShareRoomClick}
                >
                    {_t("Share room")}
                </Button>
                <Button className="mx_RoomSummaryCard_icon_settings" onClick={onRoomSettingsClick}>
                    {_t("Room settings")}
                </Button>
            </Group>

            {SettingsStore.getValue(UIFeature.Widgets) &&
                !isVideoRoom &&
                shouldShowComponent(UIComponent.AddIntegrations) && <AppsSection room={room} />}
        </BaseCard>
    );
};

export default RoomSummaryCard;
