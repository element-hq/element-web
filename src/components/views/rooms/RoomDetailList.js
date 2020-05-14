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

import * as sdk from '../../../index';
import dis from '../../../dispatcher/dispatcher';
import React from 'react';
import { _t } from '../../../languageHandler';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import classNames from 'classnames';

import {roomShape} from './RoomDetailRow';

export default createReactClass({
    displayName: 'RoomDetailList',

    propTypes: {
        rooms: PropTypes.arrayOf(roomShape),
        className: PropTypes.string,
    },

    getRows: function() {
        if (!this.props.rooms) return [];

        const RoomDetailRow = sdk.getComponent('rooms.RoomDetailRow');
        return this.props.rooms.map((room, index) => {
            return <RoomDetailRow key={index} room={room} onClick={this.onDetailsClick} />;
        });
    },

    onDetailsClick: function(ev, room) {
        dis.dispatch({
            action: 'view_room',
            room_id: room.roomId,
            room_alias: room.canonicalAlias || (room.aliases || [])[0],
        });
    },

    render() {
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
    },
});
