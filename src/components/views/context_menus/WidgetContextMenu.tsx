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

import React, { ComponentProps, useContext } from "react";
import { IWidget, MatrixCapabilities } from "matrix-widget-api";
import { logger } from "matrix-js-sdk/src/logger";
import { ApprovalOpts, WidgetLifecycle } from "@matrix-org/react-sdk-module-api/lib/lifecycles/WidgetLifecycle";

import IconizedContextMenu, { IconizedContextMenuOption, IconizedContextMenuOptionList } from "./IconizedContextMenu";
import { ChevronFace } from "../../structures/ContextMenu";
import { _t } from "../../../languageHandler";
import { isAppWidget } from "../../../stores/WidgetStore";
import WidgetUtils from "../../../utils/WidgetUtils";
import { WidgetMessagingStore } from "../../../stores/widgets/WidgetMessagingStore";
import RoomContext from "../../../contexts/RoomContext";
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

interface IProps extends Omit<ComponentProps<typeof IconizedContextMenu>, "children"> {
    app: IWidget;
    userWidget?: boolean;
    showUnpin?: boolean;
    // override delete handler
    onDeleteClick?(): void;
    // override edit handler
    onEditClick?(): void;
}

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
    const { room, roomId } = useContext(RoomContext);

    const widgetMessaging = WidgetMessagingStore.instance.getMessagingForUid(WidgetUtils.getWidgetUid(app));
    const canModify = userWidget || WidgetUtils.canUserModifyWidgets(cli, roomId);

    let streamAudioStreamButton: JSX.Element | undefined;
    if (roomId && getConfigLivestreamUrl() && WidgetType.JITSI.matches(app.type)) {
        const onStreamAudioClick = async (): Promise<void> => {
            try {
                await startJitsiAudioLivestream(cli, widgetMessaging!, roomId);
            } catch (err) {
                logger.error("Failed to start livestream", err);
                // XXX: won't i18n well, but looks like widget api only support 'message'?
                const message = err.message || _t("Unable to start audio streaming.");
                Modal.createDialog(ErrorDialog, {
                    title: _t("Failed to start livestream"),
                    description: message,
                });
            }
            onFinished();
        };
        streamAudioStreamButton = (
            <IconizedContextMenuOption onClick={onStreamAudioClick} label={_t("Start audio stream")} />
        );
    }

    const pinnedWidgets = room ? WidgetLayoutStore.instance.getContainerWidgets(room, Container.Top) : [];
    const widgetIndex = pinnedWidgets.findIndex((widget) => widget.id === app.id);

    let editButton: JSX.Element | undefined;
    if (canModify && WidgetUtils.isManagedByManager(app)) {
        const _onEditClick = (): void => {
            if (onEditClick) {
                onEditClick();
            } else if (room) {
                WidgetUtils.editWidget(room, app);
            }
            onFinished();
        };

        editButton = <IconizedContextMenuOption onClick={_onEditClick} label={_t("Edit")} />;
    }

    let snapshotButton: JSX.Element | undefined;
    const screenshotsEnabled = SettingsStore.getValue("enableWidgetScreenshots");
    if (screenshotsEnabled && widgetMessaging?.hasCapability(MatrixCapabilities.Screenshots)) {
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

        snapshotButton = <IconizedContextMenuOption onClick={onSnapshotClick} label={_t("Take a picture")} />;
    }

    let deleteButton: JSX.Element | undefined;
    if (onDeleteClick || canModify) {
        const _onDeleteClick = (): void => {
            if (onDeleteClick) {
                onDeleteClick();
            } else if (roomId) {
                // Show delete confirmation dialog
                Modal.createDialog(QuestionDialog, {
                    title: _t("Delete Widget"),
                    description: _t(
                        "Deleting a widget removes it for all users in this room." +
                            " Are you sure you want to delete this widget?",
                    ),
                    button: _t("Delete widget"),
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
                label={userWidget ? _t("Remove") : _t("Remove for everyone")}
            />
        );
    }

    const isAllowedWidget =
        (isAppWidget(app) &&
            app.eventId !== undefined &&
            (SettingsStore.getValue("allowedWidgets", roomId)[app.eventId] ?? false)) ||
        app.creatorUserId === cli.getUserId();

    const isLocalWidget = WidgetType.JITSI.matches(app.type);
    let revokeButton: JSX.Element | undefined;
    if (!userWidget && !isLocalWidget && isAllowedWidget) {
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

            revokeButton = <IconizedContextMenuOption onClick={onRevokeClick} label={_t("Revoke permissions")} />;
        }
    }

    let moveLeftButton: JSX.Element | undefined;
    if (showUnpin && widgetIndex > 0) {
        const onClick = (): void => {
            if (!room) throw new Error("room must be defined");
            WidgetLayoutStore.instance.moveWithinContainer(room, Container.Top, app, -1);
            onFinished();
        };

        moveLeftButton = <IconizedContextMenuOption onClick={onClick} label={_t("Move left")} />;
    }

    let moveRightButton: JSX.Element | undefined;
    if (showUnpin && widgetIndex < pinnedWidgets.length - 1) {
        const onClick = (): void => {
            if (!room) throw new Error("room must be defined");
            WidgetLayoutStore.instance.moveWithinContainer(room, Container.Top, app, 1);
            onFinished();
        };

        moveRightButton = <IconizedContextMenuOption onClick={onClick} label={_t("Move right")} />;
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
