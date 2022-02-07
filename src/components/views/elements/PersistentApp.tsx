/*
Copyright 2018 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import React, { ContextType } from 'react';

import ActiveWidgetStore from '../../../stores/ActiveWidgetStore';
import WidgetUtils from '../../../utils/WidgetUtils';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import AppTile from "./AppTile";
import { IApp } from '../../../stores/WidgetStore';
import MatrixClientContext from "../../../contexts/MatrixClientContext";

interface IProps {
    persistentWidgetId: string;
    pointerEvents?: string;
}

@replaceableComponent("views.elements.PersistentApp")
export default class PersistentApp extends React.Component<IProps> {
    public static contextType = MatrixClientContext;
    context: ContextType<typeof MatrixClientContext>;

    private get app(): IApp {
        const persistentWidgetInRoomId = ActiveWidgetStore.instance.getRoomId(this.props.persistentWidgetId);
        const persistentWidgetInRoom = this.context.getRoom(persistentWidgetInRoomId);

        // get the widget data
        const appEvent = WidgetUtils.getRoomWidgets(persistentWidgetInRoom).find((ev) => {
            return ev.getStateKey() === ActiveWidgetStore.instance.getPersistentWidgetId();
        });
        return WidgetUtils.makeAppConfig(
            appEvent.getStateKey(), appEvent.getContent(), appEvent.getSender(),
            persistentWidgetInRoomId, appEvent.getId(),
        );
    }

    public render(): JSX.Element {
        const app = this.app;
        if (app) {
            const persistentWidgetInRoomId = ActiveWidgetStore.instance.getRoomId(this.props.persistentWidgetId);
            const persistentWidgetInRoom = this.context.getRoom(persistentWidgetInRoomId);

            return <AppTile
                key={app.id}
                app={app}
                fullWidth={true}
                room={persistentWidgetInRoom}
                userId={this.context.credentials.userId}
                creatorUserId={app.creatorUserId}
                widgetPageTitle={WidgetUtils.getWidgetDataTitle(app)}
                waitForIframeLoad={app.waitForIframeLoad}
                miniMode={true}
                showMenubar={false}
                pointerEvents={this.props.pointerEvents}
            />;
        }
        return null;
    }
}

