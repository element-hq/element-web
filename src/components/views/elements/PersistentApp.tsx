/*
Copyright 2018 New Vector Ltd
Copyright 2019-2022 The Matrix.org Foundation C.I.C.

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

import React, { ContextType, MutableRefObject } from 'react';
import { Room } from "matrix-js-sdk/src/models/room";

import WidgetUtils from '../../../utils/WidgetUtils';
import AppTile from "./AppTile";
import { IApp } from '../../../stores/WidgetStore';
import MatrixClientContext from "../../../contexts/MatrixClientContext";

interface IProps {
    persistentWidgetId: string;
    persistentRoomId: string;
    pointerEvents?: string;
    movePersistedElement: MutableRefObject<() => void>;
}

export default class PersistentApp extends React.Component<IProps> {
    public static contextType = MatrixClientContext;
    context: ContextType<typeof MatrixClientContext>;
    private room: Room;

    constructor(props: IProps, context: ContextType<typeof MatrixClientContext>) {
        super(props, context);
        this.room = context.getRoom(this.props.persistentRoomId);
    }

    private get app(): IApp | null {
        // get the widget data
        const appEvent = WidgetUtils.getRoomWidgets(this.room).find(ev =>
            ev.getStateKey() === this.props.persistentWidgetId,
        );

        if (appEvent) {
            return WidgetUtils.makeAppConfig(
                appEvent.getStateKey(), appEvent.getContent(), appEvent.getSender(),
                this.room.roomId, appEvent.getId(),
            );
        } else {
            return null;
        }
    }

    public render(): JSX.Element {
        const app = this.app;
        if (app) {
            return <AppTile
                key={app.id}
                app={app}
                fullWidth={true}
                room={this.room}
                userId={this.context.credentials.userId}
                creatorUserId={app.creatorUserId}
                widgetPageTitle={WidgetUtils.getWidgetDataTitle(app)}
                waitForIframeLoad={app.waitForIframeLoad}
                miniMode={true}
                showMenubar={false}
                pointerEvents={this.props.pointerEvents}
                movePersistedElement={this.props.movePersistedElement}
            />;
        }
        return null;
    }
}

