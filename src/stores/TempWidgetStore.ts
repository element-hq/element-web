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

import { AsyncStoreWithClient } from "./AsyncStoreWithClient";
import defaultDispatcher from "../dispatcher/dispatcher";
import { ActionPayload } from "../dispatcher/payloads";
import Modal, { IModal } from "../Modal";
import TempWidgetDialog from "../components/views/dialogs/TempWidgetDialog";

interface IState {
    modal?: IModal<any>;
    openedFromId?: string;
}

export class TempWidgetStore extends AsyncStoreWithClient<IState> {
    private static internalInstance = new TempWidgetStore();

    private constructor() {
        super(defaultDispatcher, {});
    }

    public static get instance(): TempWidgetStore {
        return TempWidgetStore.internalInstance;
    }

    protected async onAction(payload: ActionPayload): Promise<any> {
        // nothing
    }

    public openTempWidget(requestData: any, sourceWidgetId: string) {
        Modal.createTrackedDialog('Temp Widget', '', TempWidgetDialog, {
            widgetDefinition: {...requestData},
            sourceWidgetId: sourceWidgetId,
            onFinished: (success) => {
                if (!success) {
                    TempWidgetDialog.sendExitData(sourceWidgetId, false);
                }
            },
        });
    }
}
