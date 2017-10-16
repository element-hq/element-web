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

import sdk from '../../../index';
import dis from '../../../dispatcher';
import React from 'react';
import { _t } from '../../../languageHandler';
import linkifyString from 'linkifyjs/string';
import sanitizeHtml from 'sanitize-html';
import { ContentRepo } from 'matrix-js-sdk';
import MatrixClientPeg from '../../../MatrixClientPeg';
import PropTypes from 'prop-types';

function getDisplayAliasForRoom(room) {
    return room.canonical_alias || (room.aliases ? room.aliases[0] : "");
}

const RoomDetailRow = React.createClass({
    onClick: function(ev) {
        ev.preventDefault();
        dis.dispatch({
            action: 'view_room',
            room_id: this.props.room.room_id,
        });
    },

    onTopicClick: function(ev) {
        // When clicking a link in the topic, prevent the event being propagated
        // to `onClick`.
        ev.stopPropagation();
    },

    render: function() {
        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');

        const room = this.props.room;
        const name = room.name || getDisplayAliasForRoom(room) || _t('Unnamed room');
        const topic = linkifyString(sanitizeHtml(room.topic || ''));

        const guestRead = room.world_readable ? (
                <div className="mx_RoomDirectory_perm">{ _t('World readable') }</div>
            ) : <div />;
        const guestJoin = room.guest_can_join ? (
                <div className="mx_RoomDirectory_perm">{ _t('Guests can join') }</div>
            ) : <div />;

        const perms = (guestRead || guestJoin) ? (<div className="mx_RoomDirectory_perms">
            { guestRead }
            { guestJoin }
        </div>) : <div />;

        return <tr key={room.room_id} onClick={this.onClick}>
            <td className="mx_RoomDirectory_roomAvatar">
                <BaseAvatar width={24} height={24} resizeMethod='crop'
                    name={name} idName={name}
                    url={ContentRepo.getHttpUriForMxc(
                            MatrixClientPeg.get().getHomeserverUrl(),
                            room.avatar_url, 24, 24, "crop")} />
            </td>
            <td className="mx_RoomDirectory_roomDescription">
                <div className="mx_RoomDirectory_name">{ name }</div>&nbsp;
                { perms }
                <div className="mx_RoomDirectory_topic"
                     onClick={this.onTopicClick}
                     dangerouslySetInnerHTML={{ __html: topic }} />
                <div className="mx_RoomDirectory_alias">{ getDisplayAliasForRoom(room) }</div>
            </td>
            <td className="mx_RoomDirectory_roomMemberCount">
                { room.num_joined_members }
            </td>
        </tr>;
    },
});

export default React.createClass({
    displayName: 'RoomDetailList',

    propTypes: {
        rooms: PropTypes.arrayOf(PropTypes.shape({
            name: PropTypes.string,
            topic: PropTypes.string,
            room_id: PropTypes.string,
            num_joined_members: PropTypes.number,
            canonical_alias: PropTypes.string,
            aliases: PropTypes.arrayOf(PropTypes.string),

            world_readable: PropTypes.bool,
            guest_can_join: PropTypes.bool,
        })),
    },

    getRows: function() {
        if (!this.props.rooms) return [];
        return this.props.rooms.map((room, index) => {
            return <RoomDetailRow key={index} room={room} />;
        });
    },

    render() {
        const rows = this.getRows();
        let rooms;
        if (rows.length == 0) {
            rooms = <i>{ _t('No rooms to show') }</i>;
        } else {
            rooms = <table ref="directory_table" className="mx_RoomDirectory_table">
                <tbody>
                    { this.getRows() }
                </tbody>
            </table>;
        }
        return <div className="mx_RoomDetailList">
            { rooms }
        </div>;
    },
});
