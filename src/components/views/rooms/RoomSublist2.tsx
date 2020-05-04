/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 Vector Creations Ltd
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

import * as React from "react";
import { Room } from "matrix-js-sdk/src/models/room";

interface IProps {
    forRooms: boolean;
    rooms?: Room[];
    startAsHidden: boolean;
    label: string;
    onAddRoom?: () => void;
    addRoomLabel: string;
    isInvite: boolean;

    // TODO: Collapsed state
    // TODO: Height
    // TODO: Group invites
    // TODO: Calls
    // TODO: forceExpand?
    // TODO: Header clicking
    // TODO: Spinner support for historical
}

interface IState {
}

// TODO: Actually write stub
export default class RoomSublist2 extends React.Component<IProps, IState> {
    public setHeight(size: number) {
    }

    public render() {
        // TODO: Proper rendering

        const rooms = this.props.rooms.map(r => (
            <div key={r.roomId}>{r.name} ({r.roomId})</div>
        ));
        return (
            <div>
                <h4>{this.props.label}</h4>
                {rooms}
            </div>
        );
    }
}
