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

import React, { ContextType, CSSProperties, MutableRefObject } from "react";
import { Room } from "matrix-js-sdk/src/models/room";

import WidgetUtils from "../../../utils/WidgetUtils";
import AppTile from "./AppTile";
import WidgetStore from "../../../stores/WidgetStore";
import MatrixClientContext from "../../../contexts/MatrixClientContext";

interface IProps {
    persistentWidgetId: string;
    persistentRoomId: string;
    pointerEvents?: CSSProperties["pointerEvents"];
    movePersistedElement: MutableRefObject<(() => void) | undefined>;
}

export default class PersistentApp extends React.Component<IProps> {
    public static contextType = MatrixClientContext;
    public context!: ContextType<typeof MatrixClientContext>;
    private room: Room;

    public constructor(props: IProps, context: ContextType<typeof MatrixClientContext>) {
        super(props, context);
        this.room = context.getRoom(this.props.persistentRoomId)!;
    }

    public render(): JSX.Element | null {
        const app = WidgetStore.instance.get(this.props.persistentWidgetId, this.props.persistentRoomId);
        if (!app) return null;

        return (
            <AppTile
                key={app.id}
                app={app}
                fullWidth={true}
                room={this.room}
                userId={this.context.getSafeUserId()}
                creatorUserId={app.creatorUserId}
                widgetPageTitle={WidgetUtils.getWidgetDataTitle(app)}
                waitForIframeLoad={app.waitForIframeLoad}
                miniMode={true}
                showMenubar={false}
                pointerEvents={this.props.pointerEvents}
                movePersistedElement={this.props.movePersistedElement}
            />
        );
    }
}
