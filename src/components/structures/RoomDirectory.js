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

var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var Modal = require('matrix-react-sdk/lib/Modal');
var sdk = require('matrix-react-sdk')
var dis = require('matrix-react-sdk/lib/dispatcher');

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

    joinRoom: function(roomId) {        
        var self = this;
        self.setState({ loading: true });
        // XXX: check that JS SDK suppresses duplicate attempts to join the same room
        MatrixClientPeg.get().joinRoom(roomId).done(function() {
            dis.dispatch({
                action: 'view_room',
                room_id: roomId
            });
        }, function(err) {
            console.error("Failed to join room: %s", JSON.stringify(err));
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
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
            // incrementally rather than starting over each time.
            return (a.aliases[0].search(filter) >= 0 && a.num_joined_members > 0);
        }).sort(function(a,b) {
            return a.num_joined_members - b.num_joined_members;
        });
        var rows = [];
        var self = this;
        for (var i = 0; i < rooms.length; i++) {
            var name = rooms[i].name || rooms[i].aliases[0];
            // <img src={ MatrixClientPeg.get().getAvatarUrlForRoom(rooms[i].room_id, 40, 40, "crop") } width="40" height="40" alt=""/>
            rows.unshift(
                <tbody key={ rooms[i].room_id }>
                    <tr onClick={self.joinRoom.bind(null, rooms[i].room_id)}>
                        <td className="mx_RoomDirectory_name">{ name }</td>
                        <td>{ rooms[i].aliases[0] }</td>
                        <td>{ rooms[i].num_joined_members }</td>
                    </tr>
                    <tr>
                        <td className="mx_RoomDirectory_topic" colSpan="3">{ rooms[i].topic }</td>
                    </tr>
                </tbody>
            );
        }
        return rows;
    },

    onKeyUp: function(ev) {
        this.forceUpdate();
        this.setState({ roomAlias : this.refs.roomAlias.value })
        if (ev.key == "Enter") {
            this.joinRoom(this.refs.roomAlias.value);
        }
        if (ev.key == "Down") {

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
                <RoomHeader simpleHeader="Public Rooms" />
                <div className="mx_RoomDirectory_list">
                    <input ref="roomAlias" placeholder="Join a room (e.g. #foo:domain.com)" className="mx_RoomDirectory_input" size="64" onKeyUp={ this.onKeyUp }/>
                    <div className="mx_RoomDirectory_tableWrapper">
                        <table className="mx_RoomDirectory_table">
                            <thead>
                                <tr><th width="45%">Room</th><th width="45%">Alias</th><th width="10%">Members</th></tr>
                            </thead>
                            { this.getRows(this.state.roomAlias) }
                        </table>
                    </div>
                </div>
            </div>
        );
    }
});

