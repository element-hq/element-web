/*
Copyright 2015 OpenMarket Ltd

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

var MatrixClientPeg = require("../../../../src/MatrixClientPeg");
var Modal = require("../../../../src/Modal");
var ComponentBroker = require('../../../../src/ComponentBroker');
var ErrorDialog = ComponentBroker.get("organisms/ErrorDialog");
var RoomHeader = ComponentBroker.get('molecules/RoomHeader');
var dis = require("../../../../src/dispatcher");


module.exports = React.createClass({
    displayName: 'RoomDirectory',

    getInitialState: function() {
        return {
            publicRooms: [],
            roomAlias: '',
        }
    },

    componentDidMount: function() {
        var self = this;
        MatrixClientPeg.get().publicRooms(function (err, data) {
            if (err) {
                console.error("Failed to get publicRooms: %s", JSON.stringify(err));
                Modal.createDialog(ErrorDialog, {
                    title: "Failed to get public room list",
                    description: err.message
                });
            }
            else {
                self.setState({
                    publicRooms: data.chunk
                });
                self.forceUpdate();
            }
        });
    },

    joinRoom: function(roomId) {        
        // XXX: check that JS SDK suppresses duplicate attempts to join the same room
        MatrixClientPeg.get().joinRoom(roomId).done(function() {
            dis.dispatch({
                action: 'view_room',
                room_id: roomId
            });
        }, function(err) {
            console.error("Failed to join room: %s", JSON.stringify(err));
            Modal.createDialog(ErrorDialog, {
                title: "Failed to join room",
                description: err.message
            });
        });
    },

    getRows: function(filter) {
        if (!this.state.publicRooms) return [];

        var rooms = this.state.publicRooms.filter(function(a) {
            // FIXME: if incrementally typing, keep narrowing down the search set
            return (a.aliases[0].search(filter) >= 0);
        }).sort(function(a,b) {
            return a.num_joined_members > b.num_joined_members;
        });
        var rows = [];
        var self = this;
        for (var i = 0; i < rooms.length; i++) {
            var name = rooms[i].name;
            if (!name) {
                if (rooms[i].aliases[0]) name = rooms[i].aliases[0] 
            }
            else {
                if (rooms[i].aliases[0]) name += " (" + rooms[i].aliases[0] + ")";
            }
            rows.unshift(
                <tr key={ rooms[i].room_id } onClick={ function() { self.joinRoom(rooms[i].room_id); } }>
                    <td><img src={ MatrixClientPeg.get().getAvatarUrlForRoom(rooms[i].room_id, 40, 40, "crop") } width="40" height="40" alt=""/> { name }</td>
                    <td>{ rooms[i].topic }</td>
                    <td style={ {'text-align' : 'center'} }>{ rooms[i].num_joined_members }</td>
                </tr>
            );
        }
        return rows;
    },

    onKeyUp: function(ev) {
        this.forceUpdate();
        this.setState({ roomAlias : this.refs.roomAlias.getDOMNode().value })
        if (ev.key == "Enter") {
            this.joinRoom(this.refs.roomAlias.getDOMNode().value);
        }
        if (ev.key == "Down") {

        }
    },

    render: function() {
        return (
            <div className="mx_RoomDirectory">
                <RoomHeader simpleHeader="Public Rooms" />
                <div className="mx_RoomDirectory_list">
                    <input ref="roomAlias" placeholder="Join a room (e.g. #foo:domain.com)" className="mx_RoomDirectory_input" size="64" onKeyUp={ this.onKeyUp }/>
                    <table className="mx_RoomDirectory_table">
                        <tr><th>Room</th><th>Topic</th><th>Users</th></tr>
                        { this.getRows(this.state.roomAlias) }
                    </table>
                </div>
            </div>
        );
    }
});

