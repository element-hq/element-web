/*
Copyright 2017 New Vector Ltd.

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
import { Room } from 'matrix-js-sdk/src';
import classNames from 'classnames';

import dis from '../../../dispatcher/dispatcher';
import { Action } from '../../../dispatcher/actions';
import { _t } from '../../../languageHandler';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import RoomDetailRow from "./RoomDetailRow";

interface IProps {
    rooms?: Room[];
    className?: string;
}

@replaceableComponent("views.rooms.RoomDetailList")
export default class RoomDetailList extends React.Component<IProps> {
    private getRows(): JSX.Element[] {
        if (!this.props.rooms) return [];
        return this.props.rooms.map((room, index) => {
            return <RoomDetailRow key={index} room={room} onClick={this.onDetailsClick} />;
        });
    }

    private onDetailsClick = (ev: React.MouseEvent, room: Room): void => {
        dis.dispatch({
            action: Action.ViewRoom,
            room_id: room.roomId,
            room_alias: room.getCanonicalAlias() || (room.getAltAliases() || [])[0],
        });
    };

    public render(): JSX.Element {
        const rows = this.getRows();
        let rooms;
        if (rows.length === 0) {
            rooms = <i>{ _t('No rooms to show') }</i>;
        } else {
            rooms = <table className="mx_RoomDirectory_table">
                <tbody>
                    { this.getRows() }
                </tbody>
            </table>;
        }
        return <div className={classNames("mx_RoomDetailList", this.props.className)}>
            { rooms }
        </div>;
    }
}
