/*
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import dis from '../../../dispatcher/dispatcher';
import { Action } from '../../../dispatcher/actions';
import { RoomPermalinkCreator } from '../../../utils/permalinks/Permalinks';
import { _t } from '../../../languageHandler';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import EventTileBubble from "./EventTileBubble";
import { replaceableComponent } from "../../../utils/replaceableComponent";

interface IProps {
    /* the MatrixEvent to show */
    mxEvent: MatrixEvent;
}

@replaceableComponent("views.messages.RoomCreate")
export default class RoomCreate extends React.Component<IProps> {
    private onLinkClicked = (e: React.MouseEvent): void => {
        e.preventDefault();

        const predecessor = this.props.mxEvent.getContent()['predecessor'];

        dis.dispatch({
            action: Action.ViewRoom,
            event_id: predecessor['event_id'],
            highlighted: true,
            room_id: predecessor['room_id'],
        });
    };

    public render(): JSX.Element {
        const predecessor = this.props.mxEvent.getContent()['predecessor'];
        if (predecessor === undefined) {
            return <div />; // We should never have been instantiated in this case
        }
        const prevRoom = MatrixClientPeg.get().getRoom(predecessor['room_id']);
        const permalinkCreator = new RoomPermalinkCreator(prevRoom, predecessor['room_id']);
        permalinkCreator.load();
        const predecessorPermalink = permalinkCreator.forEvent(predecessor['event_id']);
        const link = (
            <a href={predecessorPermalink} onClick={this.onLinkClicked}>
                { _t("Click here to see older messages.") }
            </a>
        );

        return <EventTileBubble
            className="mx_CreateEvent"
            title={_t("This room is a continuation of another conversation.")}
            subtitle={link}
        />;
    }
}
