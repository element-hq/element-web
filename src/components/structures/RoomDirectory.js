/*
Copyright 2015, 2016 OpenMarket Ltd

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

'use strict';

var React = require('react');

var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var ContentRepo = require("matrix-js-sdk").ContentRepo;
var Modal = require('matrix-react-sdk/lib/Modal');
var sdk = require('matrix-react-sdk')
var dis = require('matrix-react-sdk/lib/dispatcher');
var GeminiScrollbar = require('react-gemini-scrollbar');

var linkify = require('linkifyjs');
var linkifyString = require('linkifyjs/string');
var linkifyMatrix = require('matrix-react-sdk/lib/linkify-matrix');
var sanitizeHtml = require('sanitize-html');

linkifyMatrix(linkify);

module.exports = React.createClass({
    displayName: 'RoomDirectory',

    getInitialState: function() {
        return {
            publicRooms: [],
            roomAlias: '',
            loading: true,
        }
    },

    componentDidMount: function() {
        var self = this;
        MatrixClientPeg.get().publicRooms(function (err, data) {
            if (err) {
                self.setState({ loading: false });
                console.error("Failed to get publicRooms: %s", JSON.stringify(err));
                var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: "Failed to get public room list",
                    description: err.message
                });
            }
            else {
                self.setState({
                    publicRooms: data.chunk,
                    loading: false,
                });
                self.forceUpdate();
            }
        });
    },

    showRoom: function(roomId) {
        // extract the metadata from the publicRooms structure to pass
        // as out-of-band data to view_room, because we get information
        // here that we can't get other than by joining the room in some
        // cases.
        var room;
        for (var i = 0; i < this.state.publicRooms.length; ++i) {
            if (this.state.publicRooms[i].room_id == roomId) {
                room = this.state.publicRooms[i];
                break;
            }
        }
        var oob_data = {};
        if (room) {
            oob_data = {
                avatarUrl: room.avatar_url,
                // XXX: This logic is duplicated from the JS SDK which
                // would normally decide what the name is.
                name: room.name || room.aliases[0],
            };
        }

        dis.dispatch({
            action: 'view_room',
            room_id: roomId,
            oob_data: oob_data,
        });
    },

    getRows: function(filter) {
        var BaseAvatar = sdk.getComponent('avatars.BaseAvatar');

        if (!this.state.publicRooms) return [];

        var rooms = this.state.publicRooms.filter(function(a) {
            // FIXME: if incrementally typing, keep narrowing down the search set
            // incrementally rather than starting over each time.
            return (a.aliases[0].toLowerCase().search(filter.toLowerCase()) >= 0 && a.num_joined_members > 0);
        }).sort(function(a,b) {
            return a.num_joined_members - b.num_joined_members;
        });
        var rows = [];
        var self = this;
        var guestRead, guestJoin, perms;
        for (var i = 0; i < rooms.length; i++) {
            var name = rooms[i].name || rooms[i].aliases[0];
            guestRead = null;
            guestJoin = null;

            if (rooms[i].world_readable) {
                guestRead = (
                    <div className="mx_RoomDirectory_perm">World readable</div>
                );
            }
            if (rooms[i].guest_can_join) {
                guestJoin = (
                    <div className="mx_RoomDirectory_perm">Guests can join</div>
                );
            }

            perms = null;
            if (guestRead || guestJoin) {
                perms = <div className="mx_RoomDirectory_perms">{guestRead} {guestJoin}</div>;
            }

            var topic = rooms[i].topic || '';
            topic = linkifyString(sanitizeHtml(topic));

            rows.unshift(
                <tr key={ rooms[i].room_id } onClick={self.showRoom.bind(null, rooms[i].room_id)}>
                    <td className="mx_RoomDirectory_roomAvatar">
                        <BaseAvatar width={24} height={24} resizeMethod='crop'
                            name={ name } idName={ name }
                            url={ ContentRepo.getHttpUriForMxc(
                                    MatrixClientPeg.get().getHomeserverUrl(),
                                    rooms[i].avatar_url, 24, 24, "crop") } />
                    </td>
                    <td className="mx_RoomDirectory_roomDescription">
                        <div className="mx_RoomDirectory_name">{ name }</div>&nbsp;
                        { perms }
                        <div className="mx_RoomDirectory_topic"
                             onClick={ function(e) { e.stopPropagation() } }
                             dangerouslySetInnerHTML={{ __html: topic }}/>
                        <div className="mx_RoomDirectory_alias">{ rooms[i].aliases[0] }</div>
                    </td>
                    <td className="mx_RoomDirectory_roomMemberCount">
                        { rooms[i].num_joined_members }
                    </td>
                </tr>
            );
        }
        return rows;
    },

    onKeyUp: function(ev) {
        this.forceUpdate();
        this.setState({ roomAlias : this.refs.roomAlias.value })
        if (ev.key == "Enter") {
            this.showRoom(this.refs.roomAlias.value);
        }
    },

    render: function() {
        if (this.state.loading) {
            var Loader = sdk.getComponent("elements.Spinner");
            return (
                <div className="mx_RoomDirectory">
                    <Loader />
                </div>
            );
        }

        var RoomHeader = sdk.getComponent('rooms.RoomHeader');
        return (
            <div className="mx_RoomDirectory">
                <RoomHeader simpleHeader="Directory" />
                <div className="mx_RoomDirectory_list">
                    <input ref="roomAlias" placeholder="Join a room (e.g. #foo:domain.com)" className="mx_RoomDirectory_input" size="64" onKeyUp={ this.onKeyUp }/>
                    <GeminiScrollbar className="mx_RoomDirectory_tableWrapper">
                        <table ref="directory_table" className="mx_RoomDirectory_table">
                            <tbody>
                                { this.getRows(this.state.roomAlias) }
                            </tbody>
                        </table>
                    </GeminiScrollbar>
                </div>
            </div>
        );
    }
});

