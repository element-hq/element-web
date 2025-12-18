/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useContext, useMemo, useEffect, type ReactElement, type ReactNode } from "react";
import { logger } from "@sentry/browser";
import { type Room, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type IWidget, MatrixCapabilities } from "matrix-widget-api";
import {
    BaseViewModel,
    type WidgetContextMenuSnapshot,
    WidgetContextMenuView,
    type WidgetContextMenuViewModel as WidgetContextMenuViewModelInterface,
} from "@element-hq/web-shared-components";
import { type ApprovalOpts, WidgetLifecycle } from "@matrix-org/react-sdk-module-api/lib/lifecycles/WidgetLifecycle";

import ErrorDialog from "../../components/views/dialogs/ErrorDialog";
import QuestionDialog from "../../components/views/dialogs/QuestionDialog";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import { useScopedRoomContext } from "../../contexts/ScopedRoomContext";
import { _t } from "../../languageHandler";
import { getConfigLivestreamUrl, startJitsiAudioLivestream } from "../../Livestream";
import Modal from "../../Modal";
import SettingsStore from "../../settings/SettingsStore";
import { Container } from "../../stores/widgets/types";
import { WidgetLayoutStore } from "../../stores/widgets/WidgetLayoutStore";
import { WidgetMessagingStore } from "../../stores/widgets/WidgetMessagingStore";
import { isAppWidget } from "../../stores/WidgetStore";
import WidgetUtils from "../../utils/WidgetUtils";
import { WidgetType } from "../../widgets/WidgetType";
import { ModuleRunner } from "../../modules/ModuleRunner";
import { ElementWidget, type WidgetMessaging } from "../../stores/widgets/WidgetMessaging";
import dis from "../../dispatcher/dispatcher";

const checkRevokeButtonState = (
    cli: MatrixClient,
    roomId: string | undefined,
    app: IWidget,
    userWidget: boolean | undefined,
): boolean => {
    const opts: ApprovalOpts = { approved: undefined };
    ModuleRunner.instance.invoke(WidgetLifecycle.PreLoadRequest, opts, new ElementWidget(app));
    if (!opts.approved) {
        const isAllowedWidget =
            (isAppWidget(app) &&
                app.eventId !== undefined &&
                (SettingsStore.getValue("allowedWidgets", roomId)[app.eventId] ?? false)) ||
            app.creatorUserId === cli?.getUserId();

        const isLocalWidget = WidgetType.JITSI.matches(app.type);
        return !userWidget && !isLocalWidget && isAllowedWidget;
    }
    return false;
};

export class WidgetContextMenuViewModel
    extends BaseViewModel<WidgetContextMenuSnapshot, WidgetContextMenuViewModelProps>
    implements WidgetContextMenuViewModelInterface
{
    private _app: IWidget;
    private _roomId: string | undefined;
    private _room: Room | undefined;
    private _cli: MatrixClient;
    private _widgetMessaging: WidgetMessaging | undefined;

    public constructor(props: WidgetContextMenuViewModelProps) {
        const { app, cli, room, roomId, userWidget, showUnpin, menuDisplayed, trigger, onDeleteClick } = props;
        super(
            props,
            WidgetContextMenuViewModel.computeSnapshot(
                app,
                cli,
                room,
                userWidget,
                showUnpin,
                menuDisplayed,
                trigger,
                onDeleteClick,
            ),
        );
        this._app = app;
        this._roomId = roomId;
        this._room = room;
        this._cli = cli;
        this._widgetMessaging = WidgetMessagingStore.instance.getMessagingForUid(WidgetUtils.getWidgetUid(props.app));
    }

    private static readonly computeSnapshot = (
        app: IWidget,
        cli: MatrixClient,
        room: Room | undefined,
        userWidget: boolean | undefined,
        showUnpin: boolean | undefined,
        menuDisplayed: boolean,
        trigger: ReactNode,
        onDeleteClick?: () => void,
    ): WidgetContextMenuSnapshot => {
        const showStreamAudioStreamButton = !!getConfigLivestreamUrl() && WidgetType.JITSI.matches(app.type);
        const canModify = userWidget || WidgetUtils.canUserModifyWidgets(cli, room?.roomId);
        const widgetMessaging = WidgetMessagingStore.instance.getMessagingForUid(WidgetUtils.getWidgetUid(app));
        const showDeleteButton = !!onDeleteClick || canModify;

        const showSnapshotButton =
            SettingsStore.getValue("enableWidgetScreenshots") &&
            !!widgetMessaging?.widgetApi?.hasCapability(MatrixCapabilities.Screenshots);

        let showMoveButtons: [boolean, boolean] = [false, false];
        if (showUnpin) {
            const pinnedWidgets = room ? WidgetLayoutStore.instance.getContainerWidgets(room, Container.Top) : [];
            const widgetIndex = pinnedWidgets.findIndex((widget) => widget.id === app.id);
            showMoveButtons = [widgetIndex > 0, widgetIndex < pinnedWidgets.length - 1];
        }

        const showEditButton = canModify && WidgetUtils.isManagedByManager(app);

        const showRevokeButton = checkRevokeButtonState(cli, room?.roomId, app, userWidget);

        return {
            showStreamAudioStreamButton,
            showEditButton,
            showRevokeButton,
            showDeleteButton,
            showSnapshotButton,
            showMoveButtons,
            canModify,
            userWidget: !!userWidget,
            isMenuOpened: menuDisplayed,
            trigger,
        };
    };

    public get onFinished(): () => void {
        return () => this.props.onFinished!();
    }

    public get onRevokeClick(): () => void {
        return () => {
            const eventId = isAppWidget(this._app) ? this._app.eventId : undefined;
            logger.info("Revoking permission for widget to load: " + eventId);
            const current = SettingsStore.getValue("allowedWidgets", this._roomId);
            if (eventId !== undefined) current[eventId] = false;
            const level = SettingsStore.firstSupportedLevel("allowedWidgets");
            if (!level) throw new Error("level must be defined");
            SettingsStore.setValue("allowedWidgets", this._roomId ?? null, level, current).catch((err) => {
                logger.error(err);
                // We don't really need to do anything about this - the user will just hit the button again.
            });
            this.props.onFinished!();
        };
    }

    public get onDeleteClick(): () => void {
        return () => {
            if (this.props.onDeleteClick) {
                this.props.onDeleteClick();
            } else if (this._roomId) {
                // Show delete confirmation dialog
                const { finished } = Modal.createDialog(QuestionDialog, {
                    title: _t("widget|context_menu|delete"),
                    description: _t("widget|context_menu|delete_warning"),
                    button: _t("widget|context_menu|delete"),
                });

                finished.then(([confirmed]) => {
                    if (!confirmed) return;
                    WidgetUtils.setRoomWidget(this._cli, this._roomId!, this._app.id);
                });
            }

            this.props.onFinished!();
        };
    }

    public get onSnapshotClick(): () => void {
        return () => {
            this._widgetMessaging?.widgetApi
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
            this.props.onFinished!();
        };
    }

    public get onStreamAudioClick(): () => Promise<void> {
        return async () => {
            try {
                if (this._roomId) {
                    await startJitsiAudioLivestream(this._cli, this._widgetMessaging!.widgetApi!, this._roomId!);
                }
            } catch (err: any) {
                logger.error("Failed to start livestream", err);
                // XXX: won't i18n well, but looks like widget api only support 'message'?
                const message =
                    err instanceof Error ? err.message : _t("widget|error_unable_start_audio_stream_description");
                Modal.createDialog(ErrorDialog, {
                    title: _t("widget|error_unable_start_audio_stream_title"),
                    description: message,
                });
            }
            this.props.onFinished!();
        };
    }

    public get onEditClick(): () => void {
        return () => {
            if (this.props.onEditClick) {
                this.props.onEditClick();
            } else if (this._room) {
                WidgetUtils.editWidget(this._room, this._app);
            }
            this.props.onFinished!();
        };
    }

    public get onMoveButton(): (direction: number) => void {
        return (direction: number) => {
            if (!this._room) throw new Error("room must be defined");
            WidgetLayoutStore.instance.moveWithinContainer(this._room, Container.Top, this._app, direction);
            this.props.onFinished!();
        };
    }
}

interface WidgetContextMenuProps {
    app: IWidget;
    userWidget?: boolean;
    showUnpin?: boolean;
    menuDisplayed: boolean;
    trigger: ReactNode;
    // override delete handler
    onDeleteClick?(): void;
    // override edit handler
    onEditClick?(): void;
    onFinished(): void;
}

export type WidgetContextMenuViewModelProps = WidgetContextMenuProps & {
    cli: MatrixClient;
    room: Room | undefined;
    roomId: string | undefined;
};

export function WidgetContextMenu(props: WidgetContextMenuProps): ReactElement {
    const { app, userWidget, showUnpin, menuDisplayed, trigger, onEditClick, onDeleteClick, onFinished } = props;
    const cli = useContext(MatrixClientContext);
    const { room, roomId } = useScopedRoomContext("room", "roomId");

    const vm = useMemo(
        () =>
            new WidgetContextMenuViewModel({
                menuDisplayed,
                room,
                roomId,
                cli,
                app,
                showUnpin,
                userWidget,
                trigger,
                onEditClick,
                onDeleteClick,
                onFinished,
            }),
        [app, room, roomId, userWidget, showUnpin, menuDisplayed, cli, trigger, onEditClick, onDeleteClick, onFinished],
    );

    useEffect(() => {
        return () => {
            vm.dispose();
        };
    }, [vm]);

    const {
        showStreamAudioStreamButton,
        showEditButton,
        showRevokeButton,
        showDeleteButton,
        showSnapshotButton,
        showMoveButtons,
    } = vm.getSnapshot();

    const hasContextMenuOptions =
        showStreamAudioStreamButton ||
        showEditButton ||
        showRevokeButton ||
        showDeleteButton ||
        showSnapshotButton ||
        showMoveButtons.some(Boolean);

    return hasContextMenuOptions ? <WidgetContextMenuView vm={vm} /> : <></>;
}
