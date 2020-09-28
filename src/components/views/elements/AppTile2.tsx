/*
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ClientWidgetApi, Widget, WidgetKind } from "matrix-widget-api";
import * as React from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { WidgetMessagingStore } from "../../../stores/widgets/WidgetMessagingStore";

interface IProps {
    widget: Widget;
    kind: WidgetKind;
    room?: Room;

    // TODO: All the showUIElement props
}

interface IState {
    loading: boolean;
}

export class AppTile2 extends React.PureComponent<IProps, IState> {
    private messaging: ClientWidgetApi;
    private iframeRef = React.createRef<HTMLIFrameElement>();

    public constructor(props: IProps) {
        super(props);

        if (props.kind === WidgetKind.Room && !props.room) {
            throw new Error("Expected room when supplied with a room widget");
        }

        this.state = {
            loading: true,
        };
    }

    private get isMixedContent(): boolean {
        const myProtocol = window.location.protocol;
        const widgetProtocol = new URL(this.props.widget.templateUrl).protocol;
        return myProtocol === 'https:' && widgetProtocol !== 'https:';
    }

    public componentDidMount() {
        if (!this.iframeRef.current) {
            throw new Error("iframe has not yet been associated - fix the render code");
        }

        // TODO: Provide capabilities to widget messaging

        if (this.props.kind === WidgetKind.Room) {
            this.messaging = WidgetMessagingStore.instance
                .generateMessagingForRoomWidget(this.props.room, this.props.widget, this.iframeRef.current);
        } else if (this.props.kind === WidgetKind.Account) {
            this.messaging = WidgetMessagingStore.instance
                .generateMessagingForAccountWidget(this.props.widget, this.iframeRef.current);
        } else {
            throw new Error("Unexpected widget kind: " + this.props.kind);
        }

        this.messaging.once("ready", () => {
            this.setState({loading: false});
        });
    }
}
