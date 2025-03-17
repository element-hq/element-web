/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IModalWidgetOpenRequestData, type IModalWidgetReturnData, type Widget } from "matrix-widget-api";
import { logger } from "matrix-js-sdk/src/logger";

import { AsyncStoreWithClient } from "./AsyncStoreWithClient";
import defaultDispatcher from "../dispatcher/dispatcher";
import { type ActionPayload } from "../dispatcher/payloads";
import Modal, { type IHandle, type IModal } from "../Modal";
import ModalWidgetDialog from "../components/views/dialogs/ModalWidgetDialog";
import { WidgetMessagingStore } from "./widgets/WidgetMessagingStore";

interface IState {
    modal?: IModal<any>;
    openedFromId?: string;
}

export class ModalWidgetStore extends AsyncStoreWithClient<IState> {
    private static readonly internalInstance = (() => {
        const instance = new ModalWidgetStore();
        instance.start();
        return instance;
    })();
    private modalInstance: IHandle<typeof ModalWidgetDialog> | null = null;
    private openSourceWidgetId: string | null = null;
    private openSourceWidgetRoomId: string | null = null;

    private constructor() {
        super(defaultDispatcher, {});
    }

    public static get instance(): ModalWidgetStore {
        return ModalWidgetStore.internalInstance;
    }

    protected async onAction(payload: ActionPayload): Promise<any> {
        // nothing
    }

    public canOpenModalWidget = (): boolean => {
        return !this.modalInstance;
    };

    public openModalWidget = (
        requestData: IModalWidgetOpenRequestData,
        sourceWidget: Widget,
        widgetRoomId?: string,
    ): void => {
        if (this.modalInstance) return;
        this.openSourceWidgetId = sourceWidget.id;
        this.openSourceWidgetRoomId = widgetRoomId ?? null;
        this.modalInstance = Modal.createDialog(
            ModalWidgetDialog,
            {
                widgetDefinition: { ...requestData },
                widgetRoomId,
                sourceWidgetId: sourceWidget.id,
                onFinished: (success, data) => {
                    this.closeModalWidget(sourceWidget, widgetRoomId, success && data ? data : { "m.exited": true });

                    this.openSourceWidgetId = null;
                    this.openSourceWidgetRoomId = null;
                    this.modalInstance = null;
                },
            },
            undefined,
            /* priority = */ false,
            /* static = */ true,
        );
    };

    public closeModalWidget = (
        sourceWidget: Widget,
        widgetRoomId: string | undefined,
        data: IModalWidgetReturnData,
    ): void => {
        if (!this.modalInstance) return;
        if (this.openSourceWidgetId === sourceWidget.id && this.openSourceWidgetRoomId === widgetRoomId) {
            this.openSourceWidgetId = null;
            this.openSourceWidgetRoomId = null;
            this.modalInstance.close();
            this.modalInstance = null;

            const sourceMessaging = WidgetMessagingStore.instance.getMessaging(sourceWidget, widgetRoomId);
            if (!sourceMessaging) {
                logger.error("No source widget messaging for modal widget");
                return;
            }
            sourceMessaging.notifyModalWidgetClose(data);
        }
    };
}

window.mxModalWidgetStore = ModalWidgetStore.instance;
