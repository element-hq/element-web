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

import { IModalWidgetOpenRequestData, IModalWidgetReturnData, Widget } from "matrix-widget-api";
import { logger } from "matrix-js-sdk/src/logger";

import { AsyncStoreWithClient } from "./AsyncStoreWithClient";
import defaultDispatcher from "../dispatcher/dispatcher";
import { ActionPayload } from "../dispatcher/payloads";
import Modal, { IHandle, IModal } from "../Modal";
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
                    if (!success) {
                        this.closeModalWidget(sourceWidget, widgetRoomId, { "m.exited": true });
                    } else {
                        this.closeModalWidget(sourceWidget, widgetRoomId, data);
                    }

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
