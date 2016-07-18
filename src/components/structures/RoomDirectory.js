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

    componentWillMount: function() {
        // dis.dispatch({
        //     action: 'ui_opacity',
        //     sideOpacity: 0.3,
        //     middleOpacity: 0.3,
        // });
    },

    componentDidMount: function() {
        this.getPublicRooms();
    },

    componentWillUnmount: function() {
        // dis.dispatch({
        //     action: 'ui_opacity',
        //     sideOpacity: 1.0,
        //     middleOpacity: 1.0,
        // });
    },

    getPublicRooms: function() {
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
            }
        });
    },

    /**
     * A limited interface for removing rooms from the directory.
     * Will set the room to not be publicly visible and delete the
     * default alias. In the long term, it would be better to allow
     * HS admins to do this through the RoomSettings interface, but
     * this needs SPEC-417.
     */
    removeFromDirectory: function(room) {
        var alias = get_display_alias_for_room(room);
        var name = room.name || alias || "Unnamed room";

        var QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");

        var desc;
        if (alias) {
            desc = `Delete the room alias '${alias}' and remove '${name}' from the directory?`;
        } else {
            desc = `Remove '${name}' from the directory?`;
        }

        Modal.createDialog(QuestionDialog, {
            title: "Remove from Directory",
            description: desc,
            onFinished: (should_delete) => {
                if (!should_delete) return;

                var Loader = sdk.getComponent("elements.Spinner");
                var modal = Modal.createDialog(Loader);
                var step = `remove '${name}' from the directory.`;

                MatrixClientPeg.get().setRoomDirectoryVisibility(room.room_id, 'private').then(() => {
                    if (!alias) return;
                    step = 'delete the alias.';
                    return MatrixClientPeg.get().deleteAlias(alias);
                }).done(() => {
                    modal.close();
                    this.getPublicRooms();
                }, function(err) {
                    modal.close();
                    this.getPublicRooms();
                    Modal.createDialog(ErrorDialog, {
                        title: "Failed to "+step,
                        description: err.toString()
                    });
                });
            }
        });
    },

    onRoomClicked: function(room, ev) {
        if (ev.shiftKey) {
            ev.preventDefault();
            this.removeFromDirectory(room);
        } else {
            this.showRoom(room);
        }
    },

    showRoomAlias: function(alias) {
        this.showRoom(null, alias);
    },

    showRoom: function(room, room_alias) {
        var payload = {action: 'view_room'};
        if (room) {
            // Don't let the user view a room they won't be able to either
            // peek or join: fail earlier so they don't have to click back
            // to the directory.
            if (MatrixClientPeg.get().isGuest()) {
                if (!room.world_readable && !room.guest_can_join) {
                    var NeedToRegisterDialog = sdk.getComponent("dialogs.NeedToRegisterDialog");
                    Modal.createDialog(NeedToRegisterDialog, {
                        title: "Failed to join the room",
                        description: "This room is inaccessible to guests. You may be able to join if you register."
                    });
                    return;
                }
            }

            if (!room_alias) {
                room_alias = get_display_alias_for_room(room);
            }

            payload.oob_data = {
                avatarUrl: room.avatar_url,
                // XXX: This logic is duplicated from the JS SDK which
                // would normally decide what the name is.
                name: room.name || room_alias || "Unnamed room",
            };
        }
        // It's not really possible to join Matrix rooms by ID because the HS has no way to know
        // which servers to start querying. However, there's no other way to join rooms in
        // this list without aliases at present, so if roomAlias isn't set here we have no
        // choice but to supply the ID.
        if (room_alias) {
            payload.room_alias = room_alias;
        } else {
            payload.room_id = room.room_id;
        }
        dis.dispatch(payload);
    },

    getRows: function(filter) {
        var BaseAvatar = sdk.getComponent('avatars.BaseAvatar');

        if (!this.state.publicRooms) return [];

        var rooms = this.state.publicRooms.filter(function(a) {
            // FIXME: if incrementally typing, keep narrowing down the search set
            // incrementally rather than starting over each time.
            return (((a.name && a.name.toLowerCase().search(filter.toLowerCase()) >= 0) ||
                     (a.aliases && a.aliases[0].toLowerCase().search(filter.toLowerCase()) >= 0)) &&
                      a.num_joined_members > 0);
        }).sort(function(a,b) {
            return a.num_joined_members - b.num_joined_members;
        });
        var rows = [];
        var self = this;
        var guestRead, guestJoin, perms;
        for (var i = 0; i < rooms.length; i++) {
            var name = rooms[i].name || get_display_alias_for_room(rooms[i]) || "Unnamed room";
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
                <tr key={ rooms[i].room_id }
                    onClick={self.onRoomClicked.bind(self, rooms[i])}
                    // cancel onMouseDown otherwise shift-clicking highlights text
                    onMouseDown={(ev) => {ev.preventDefault();}}
                >
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
                        <div className="mx_RoomDirectory_alias">{ get_display_alias_for_room(rooms[i]) }</div>
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
            this.showRoomAlias(this.refs.roomAlias.value);
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

        var SimpleRoomHeader = sdk.getComponent('rooms.SimpleRoomHeader');
        return (
            <div className="mx_RoomDirectory">
                <SimpleRoomHeader title="Directory" />
                <div className="mx_RoomDirectory_list">
                    <input ref="roomAlias" placeholder="Join a room (e.g. #foo:domain.com)" className="mx_RoomDirectory_input" size="64" onKeyUp={ this.onKeyUp }/>
                    <GeminiScrollbar className="mx_RoomDirectory_tableWrapper"
                                     relayoutOnUpdate={false} >
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

// Similar to matrix-react-sdk's MatrixTools.getDisplayAliasForRoom
// but works with the objects we get from the public room list
function get_display_alias_for_room(room) {
    return  room.canonical_alias || (room.aliases ? room.aliases[0] : "");
}
