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

import React, { useContext } from "react";
import { MatrixCapabilities } from "matrix-widget-api";
import { logger } from "matrix-js-sdk/src/logger";

import IconizedContextMenu, { IconizedContextMenuOption, IconizedContextMenuOptionList } from "./IconizedContextMenu";
import { ChevronFace } from "../../structures/ContextMenu";
import { _t } from "../../../languageHandler";
import { IApp } from "../../../stores/WidgetStore";
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

interface IProps extends React.ComponentProps<typeof IconizedContextMenu> {
    app: IApp;
    userWidget?: boolean;
    showUnpin?: boolean;
    // override delete handler
    onDeleteClick?(): void;
    // override edit handler
    onEditClick?(): void;
}

const WidgetContextMenu: React.FC<IProps> = ({
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
    const canModify = userWidget || WidgetUtils.canUserModifyWidgets(roomId);

    let streamAudioStreamButton;
    if (getConfigLivestreamUrl() && WidgetType.JITSI.matches(app.type)) {
        const onStreamAudioClick = async () => {
            try {
                await startJitsiAudioLivestream(widgetMessaging, roomId);
            } catch (err) {
                logger.error("Failed to start livestream", err);
                // XXX: won't i18n well, but looks like widget api only support 'message'?
                const message = err.message || _t("Unable to start audio streaming.");
                Modal.createDialog(ErrorDialog, {
                    title: _t('Failed to start livestream'),
                    description: message,
                });
            }
            onFinished();
        };
        streamAudioStreamButton = <IconizedContextMenuOption
            onClick={onStreamAudioClick}
            label={_t("Start audio stream")}
        />;
    }

    const pinnedWidgets = WidgetLayoutStore.instance.getContainerWidgets(room, Container.Top);
    const widgetIndex = pinnedWidgets.findIndex(widget => widget.id === app.id);

    let editButton;
    if (canModify && WidgetUtils.isManagedByManager(app)) {
        const _onEditClick = () => {
            if (onEditClick) {
                onEditClick();
            } else {
                WidgetUtils.editWidget(room, app);
            }
            onFinished();
        };

        editButton = <IconizedContextMenuOption onClick={_onEditClick} label={_t("Edit")} />;
    }

    let snapshotButton;
    const screenshotsEnabled = SettingsStore.getValue("enableWidgetScreenshots");
    if (screenshotsEnabled && widgetMessaging?.hasCapability(MatrixCapabilities.Screenshots)) {
        const onSnapshotClick = () => {
            widgetMessaging?.takeScreenshot().then(data => {
                dis.dispatch({
                    action: 'picture_snapshot',
                    file: data.screenshot,
                });
            }).catch(err => {
                logger.error("Failed to take screenshot: ", err);
            });
            onFinished();
        };

        snapshotButton = <IconizedContextMenuOption onClick={onSnapshotClick} label={_t("Take a picture")} />;
    }

    let deleteButton;
    if (onDeleteClick || canModify) {
        const _onDeleteClick = () => {
            if (onDeleteClick) {
                onDeleteClick();
            } else {
                // Show delete confirmation dialog
                Modal.createDialog(QuestionDialog, {
                    title: _t("Delete Widget"),
                    description: _t(
                        "Deleting a widget removes it for all users in this room." +
                        " Are you sure you want to delete this widget?"),
                    button: _t("Delete widget"),
                    onFinished: (confirmed) => {
                        if (!confirmed) return;
                        WidgetUtils.setRoomWidget(roomId, app.id);
                    },
                });
            }

            onFinished();
        };

        deleteButton = <IconizedContextMenuOption
            onClick={_onDeleteClick}
            label={userWidget ? _t("Remove") : _t("Remove for everyone")}
        />;
    }

    let isAllowedWidget = SettingsStore.getValue("allowedWidgets", roomId)[app.eventId];
    if (isAllowedWidget === undefined) {
        isAllowedWidget = app.creatorUserId === cli.getUserId();
    }

    const isLocalWidget = WidgetType.JITSI.matches(app.type);
    let revokeButton;
    if (!userWidget && !isLocalWidget && isAllowedWidget) {
        const onRevokeClick = () => {
            logger.info("Revoking permission for widget to load: " + app.eventId);
            const current = SettingsStore.getValue("allowedWidgets", roomId);
            current[app.eventId] = false;
            const level = SettingsStore.firstSupportedLevel("allowedWidgets");
            SettingsStore.setValue("allowedWidgets", roomId, level, current).catch(err => {
                logger.error(err);
                // We don't really need to do anything about this - the user will just hit the button again.
            });
            onFinished();
        };

        revokeButton = <IconizedContextMenuOption onClick={onRevokeClick} label={_t("Revoke permissions")} />;
    }

    let moveLeftButton;
    if (showUnpin && widgetIndex > 0) {
        const onClick = () => {
            WidgetLayoutStore.instance.moveWithinContainer(room, Container.Top, app, -1);
            onFinished();
        };

        moveLeftButton = <IconizedContextMenuOption onClick={onClick} label={_t("Move left")} />;
    }

    let moveRightButton;
    if (showUnpin && widgetIndex < pinnedWidgets.length - 1) {
        const onClick = () => {
            WidgetLayoutStore.instance.moveWithinContainer(room, Container.Top, app, 1);
            onFinished();
        };

        moveRightButton = <IconizedContextMenuOption onClick={onClick} label={_t("Move right")} />;
    }

    return <IconizedContextMenu {...props} chevronFace={ChevronFace.None} onFinished={onFinished}>
        <IconizedContextMenuOptionList>
            { streamAudioStreamButton }
            { editButton }
            { revokeButton }
            { deleteButton }
            { snapshotButton }
            { moveLeftButton }
            { moveRightButton }
        </IconizedContextMenuOptionList>
    </IconizedContextMenu>;
};

export default WidgetContextMenu;
