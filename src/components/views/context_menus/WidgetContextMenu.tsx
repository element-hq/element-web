/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ComponentProps, useContext } from "react";
import { type ClientWidgetApi, type IWidget, MatrixCapabilities } from "matrix-widget-api";
import { logger } from "matrix-js-sdk/src/logger";
import { type ApprovalOpts, WidgetLifecycle } from "@matrix-org/react-sdk-module-api/lib/lifecycles/WidgetLifecycle";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import IconizedContextMenu, { IconizedContextMenuOption, IconizedContextMenuOptionList } from "./IconizedContextMenu";
import { ChevronFace } from "../../structures/ContextMenu";
import { _t } from "../../../languageHandler";
import { isAppWidget } from "../../../stores/WidgetStore";
import WidgetUtils from "../../../utils/WidgetUtils";
import { WidgetMessagingStore } from "../../../stores/widgets/WidgetMessagingStore";
import dis from "../../../dispatcher/dispatcher";
import SettingsStore from "../../../settings/SettingsStore";
import Modal from "../../../Modal";
import QuestionDialog from "../dialogs/QuestionDialog";
import ErrorDialog from "../dialogs/ErrorDialog";
import { WidgetType } from "../../../widgets/WidgetType";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { Container, WidgetLayoutStore } from "../../../stores/widgets/WidgetLayoutStore";
import { getConfigLivestreamUrl, startJitsiAudioLivestream } from "../../../Livestream";
import { ModuleRunner } from "../../../modules/ModuleRunner";
import { ElementWidget } from "../../../stores/widgets/StopGapWidget";
import { useScopedRoomContext } from "../../../contexts/ScopedRoomContext.tsx";

interface IProps extends Omit<ComponentProps<typeof IconizedContextMenu>, "children"> {
    app: IWidget;
    userWidget?: boolean;
    showUnpin?: boolean;
    // override delete handler
    onDeleteClick?(): void;
    // override edit handler
    onEditClick?(): void;
}

const showStreamAudioStreamButton = (app: IWidget): boolean => {
    return !!getConfigLivestreamUrl() && WidgetType.JITSI.matches(app.type);
};

const showEditButton = (app: IWidget, canModify: boolean): boolean => {
    return canModify && WidgetUtils.isManagedByManager(app);
};

const showRevokeButton = (
    cli: MatrixClient,
    roomId: string | undefined,
    app: IWidget,
    userWidget: boolean | undefined,
): boolean => {
    const isAllowedWidget =
        (isAppWidget(app) &&
            app.eventId !== undefined &&
            (SettingsStore.getValue("allowedWidgets", roomId)[app.eventId] ?? false)) ||
        app.creatorUserId === cli?.getUserId();

    const isLocalWidget = WidgetType.JITSI.matches(app.type);
    return !userWidget && !isLocalWidget && isAllowedWidget;
};

const showDeleteButton = (canModify: boolean, onDeleteClick: undefined | (() => void)): boolean => {
    return !!onDeleteClick || canModify;
};

const showSnapshotButton = (widgetMessaging: ClientWidgetApi | undefined): boolean => {
    return (
        SettingsStore.getValue("enableWidgetScreenshots") &&
        !!widgetMessaging?.hasCapability(MatrixCapabilities.Screenshots)
    );
};

const showMoveButtons = (app: IWidget, room: Room | undefined, showUnpin: boolean | undefined): [boolean, boolean] => {
    if (!showUnpin) return [false, false];

    const pinnedWidgets = room ? WidgetLayoutStore.instance.getContainerWidgets(room, Container.Top) : [];
    const widgetIndex = pinnedWidgets.findIndex((widget) => widget.id === app.id);
    return [widgetIndex > 0, widgetIndex < pinnedWidgets.length - 1];
};

export const showContextMenu = (
    cli: MatrixClient,
    room: Room | undefined,
    app: IWidget,
    userWidget: boolean,
    showUnpin: boolean,
    onDeleteClick: (() => void) | undefined,
): boolean => {
    const canModify = userWidget || WidgetUtils.canUserModifyWidgets(cli, room?.roomId);
    const widgetMessaging = WidgetMessagingStore.instance.getMessagingForUid(WidgetUtils.getWidgetUid(app));
    return (
        showStreamAudioStreamButton(app) ||
        showEditButton(app, canModify) ||
        showRevokeButton(cli, room?.roomId, app, userWidget) ||
        showDeleteButton(canModify, onDeleteClick) ||
        showSnapshotButton(widgetMessaging) ||
        showMoveButtons(app, room, showUnpin).some(Boolean)
    );
};

export const WidgetContextMenu: React.FC<IProps> = ({
    onFinished,
    app,
    userWidget,
    onDeleteClick,
    onEditClick,
    showUnpin,
    ...props
}) => {
    const cli = useContext(MatrixClientContext);
    const { room, roomId } = useScopedRoomContext("room", "roomId");

    const widgetMessaging = WidgetMessagingStore.instance.getMessagingForUid(WidgetUtils.getWidgetUid(app));
    const canModify = userWidget || WidgetUtils.canUserModifyWidgets(cli, roomId);

    let streamAudioStreamButton: JSX.Element | undefined;
    if (roomId && showStreamAudioStreamButton(app)) {
        const onStreamAudioClick = async (): Promise<void> => {
            try {
                await startJitsiAudioLivestream(cli, widgetMessaging!, roomId);
            } catch (err) {
                logger.error("Failed to start livestream", err);
                // XXX: won't i18n well, but looks like widget api only support 'message'?
                const message =
                    err instanceof Error ? err.message : _t("widget|error_unable_start_audio_stream_description");
                Modal.createDialog(ErrorDialog, {
                    title: _t("widget|error_unable_start_audio_stream_title"),
                    description: message,
                });
            }
            onFinished();
        };
        streamAudioStreamButton = (
            <IconizedContextMenuOption
                onClick={onStreamAudioClick}
                label={_t("widget|context_menu|start_audio_stream")}
            />
        );
    }

    let editButton: JSX.Element | undefined;
    if (showEditButton(app, canModify)) {
        const _onEditClick = (): void => {
            if (onEditClick) {
                onEditClick();
            } else if (room) {
                WidgetUtils.editWidget(room, app);
            }
            onFinished();
        };

        editButton = <IconizedContextMenuOption onClick={_onEditClick} label={_t("action|edit")} />;
    }

    let snapshotButton: JSX.Element | undefined;
    if (showSnapshotButton(widgetMessaging)) {
        const onSnapshotClick = (): void => {
            widgetMessaging
                ?.takeScreenshot()
                .then((data) => {
                    dis.dispatch({
                        action: "picture_snapshot",
                        file: data.screenshot,
                    });
                })
                .catch((err) => {
                    logger.error("Failed to take screenshot: ", err);
                });
            onFinished();
        };

        snapshotButton = (
            <IconizedContextMenuOption onClick={onSnapshotClick} label={_t("widget|context_menu|screenshot")} />
        );
    }

    let deleteButton: JSX.Element | undefined;
    if (showDeleteButton(canModify, onDeleteClick)) {
        const _onDeleteClick = (): void => {
            if (onDeleteClick) {
                onDeleteClick();
            } else if (roomId) {
                // Show delete confirmation dialog
                Modal.createDialog(QuestionDialog, {
                    title: _t("widget|context_menu|delete"),
                    description: _t("widget|context_menu|delete_warning"),
                    button: _t("widget|context_menu|delete"),
                    onFinished: (confirmed) => {
                        if (!confirmed) return;
                        WidgetUtils.setRoomWidget(cli, roomId, app.id);
                    },
                });
            }

            onFinished();
        };

        deleteButton = (
            <IconizedContextMenuOption
                onClick={_onDeleteClick}
                label={userWidget ? _t("action|remove") : _t("widget|context_menu|remove")}
            />
        );
    }

    let revokeButton: JSX.Element | undefined;
    if (showRevokeButton(cli, roomId, app, userWidget)) {
        const opts: ApprovalOpts = { approved: undefined };
        ModuleRunner.instance.invoke(WidgetLifecycle.PreLoadRequest, opts, new ElementWidget(app));

        if (!opts.approved) {
            const onRevokeClick = (): void => {
                const eventId = isAppWidget(app) ? app.eventId : undefined;
                logger.info("Revoking permission for widget to load: " + eventId);
                const current = SettingsStore.getValue("allowedWidgets", roomId);
                if (eventId !== undefined) current[eventId] = false;
                const level = SettingsStore.firstSupportedLevel("allowedWidgets");
                if (!level) throw new Error("level must be defined");
                SettingsStore.setValue("allowedWidgets", roomId ?? null, level, current).catch((err) => {
                    logger.error(err);
                    // We don't really need to do anything about this - the user will just hit the button again.
                });
                onFinished();
            };

            revokeButton = (
                <IconizedContextMenuOption onClick={onRevokeClick} label={_t("widget|context_menu|revoke")} />
            );
        }
    }

    const [showMoveLeftButton, showMoveRightButton] = showMoveButtons(app, room, showUnpin);
    let moveLeftButton: JSX.Element | undefined;
    if (showMoveLeftButton) {
        const onClick = (): void => {
            if (!room) throw new Error("room must be defined");
            WidgetLayoutStore.instance.moveWithinContainer(room, Container.Top, app, -1);
            onFinished();
        };

        moveLeftButton = <IconizedContextMenuOption onClick={onClick} label={_t("widget|context_menu|move_left")} />;
    }

    let moveRightButton: JSX.Element | undefined;
    if (showMoveRightButton) {
        const onClick = (): void => {
            if (!room) throw new Error("room must be defined");
            WidgetLayoutStore.instance.moveWithinContainer(room, Container.Top, app, 1);
            onFinished();
        };

        moveRightButton = <IconizedContextMenuOption onClick={onClick} label={_t("widget|context_menu|move_right")} />;
    }

    return (
        <IconizedContextMenu {...props} chevronFace={ChevronFace.None} onFinished={onFinished}>
            <IconizedContextMenuOptionList>
                {streamAudioStreamButton}
                {editButton}
                {revokeButton}
                {deleteButton}
                {snapshotButton}
                {moveLeftButton}
                {moveRightButton}
            </IconizedContextMenuOptionList>
        </IconizedContextMenu>
    );
};
