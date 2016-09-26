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
var sdk = require('matrix-react-sdk');
var dis = require('matrix-react-sdk/lib/dispatcher');
var GeminiScrollbar = require('react-gemini-scrollbar');

var linkify = require('linkifyjs');
var linkifyString = require('linkifyjs/string');
var linkifyMatrix = require('matrix-react-sdk/lib/linkify-matrix');
var sanitizeHtml = require('sanitize-html');
var q = require('q');

linkifyMatrix(linkify);

module.exports = React.createClass({
    displayName: 'RoomDirectory',

    propTypes: {
        config: React.PropTypes.object,
    },

    getDefaultProps: function() {
        return {
            config: {
                networks: [],
            },
        }
    },

    getInitialState: function() {
        return {
            publicRooms: [],
            loading: true,
            filterByNetwork: null,
        }
    },

    componentWillMount: function() {
        // precompile Regexps
        this.networkPatterns = {};
        if (this.props.config.networkPatterns) {
            for (const network of Object.keys(this.props.config.networkPatterns)) {
                this.networkPatterns[network] = new RegExp(this.props.config.networkPatterns[network]);
            }
        }
        this.nextBatch = null;
        this.filterString = null;
        this.filterTimeout = null;
        this.scrollPanel = null;

        // dis.dispatch({
        //     action: 'ui_opacity',
        //     sideOpacity: 0.3,
        //     middleOpacity: 0.3,
        // });
    },

    componentDidMount: function() {
        this.refreshRoomList();
    },

    componentWillUnmount: function() {
        // dis.dispatch({
        //     action: 'ui_opacity',
        //     sideOpacity: 1.0,
        //     middleOpacity: 1.0,
        // });
    },

    refreshRoomList: function() {
        this.nextBatch = null;
        this.setState({
            publicRooms: [],
            loading: true,
        });
        this.getMoreRooms().done();
    },

    getMoreRooms: function() {
        if (!MatrixClientPeg.get()) return q();

        const my_filter_string = this.filterString;
        const opts = {limit: 20};
        if (this.nextBatch) opts.since = this.nextBatch;
        if (this.filterString) opts.filter = { generic_search_term: my_filter_string } ;
        return MatrixClientPeg.get().publicRooms(opts).then((data) => {
            if (my_filter_string != this.filterString) {
                // if the filter has changed since this request was sent,
                // throw away the result (don't even clear the busy flag
                // since we must still have a request in flight)
                return;
            }

            this.nextBatch = data.next_batch;
            this.setState((s) => {
                s.publicRooms.push(...data.chunk);
                s.loading = false;
                return s;
            });
            return Boolean(data.next_batch);
        }, (err) => {
            if (my_filter_string != this.filterString) {
                // as above: we don't care about errors for old
                // requests either
                return;
            }
            this.setState({ loading: false });
            console.error("Failed to get publicRooms: %s", JSON.stringify(err));
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Failed to get public room list",
                description: err.message
            });
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
                    this.refreshRoomList();
                }, function(err) {
                    modal.close();
                    this.refreshRoomList();
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

    onNetworkChange: function(network) {
        this.setState({
            filterByNetwork: network,
        }, () => {
            // we just filtered out a bunch of rooms, so check to see if
            // we need to fill up the scrollpanel again
            // NB. Because we filter the results, the HS can keep giving
            // us more rooms and we'll keep requesting more if none match
            // the filter, which is pretty terrible. We need a way
            // to filter by network on the server.
            if (this.scrollPanel) this.scrollPanel.checkFillState();
        });
    },

    onFillRequest: function(backwards) {
        if (backwards || !this.nextBatch) return q(false);

        return this.getMoreRooms();
    },

    onFilterChange: function(alias) {
        this.filterString = alias || null;

        // don't send the request for a little bit,
        // no point hammering the server with a
        // request for every keystroke, let the
        // user finish typing.
        if (this.filterTimeout) {
            clearTimeout(this.filterTimeout);
        }
        this.filterTimeout = setTimeout(() => {
            this.filterTimeout = null;
            this.refreshRoomList();
        }, 300);
    },

    onFilterClear: function() {
        this.filterString = null;

        if (this.filterTimeout) {
            clearTimeout(this.filterTimeout);
        }
        // update immediately
        this.refreshRoomList();
    },

    onJoinClick: function(alias) {
        this.showRoomAlias(alias);
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

    getRows: function() {
        var BaseAvatar = sdk.getComponent('avatars.BaseAvatar');

        if (!this.state.publicRooms) return [];

        var rooms = this.state.publicRooms.filter((a) => {
            if (this.state.filterByNetwork) {
                if (!this._isRoomInNetwork(a, this.state.filterByNetwork)) return false;
            }

            return true;
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

            rows.push(
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

    collectScrollPanel: function(element) {
        this.scrollPanel = element;
    },

    /**
     * Terrible temporary function that guess what network a public room
     * entry is in, until synapse is able to tell us
     */
    _isRoomInNetwork(room, network) {
        if (room.aliases && this.networkPatterns[network]) {
            for (const alias of room.aliases) {
                if (this.networkPatterns[network].test(alias)) return true;
            }
        }

        return false;
    },

    render: function() {
        let content;
        if (this.state.loading) {
            const Loader = sdk.getComponent("elements.Spinner");
            content = <div className="mx_RoomDirectory">
                <Loader />
            </div>;
        } else {
            const ScrollPanel = sdk.getComponent("structures.ScrollPanel");
            content = <ScrollPanel ref={this.collectScrollPanel}
                className="mx_RoomDirectory_tableWrapper"
                onFillRequest={ this.onFillRequest }
                stickyBottom={false}
                startAtBottom={false}
                onResize={function(){}}
            >
                <table ref="directory_table" className="mx_RoomDirectory_table">
                    <tbody>
                        { this.getRows() }
                    </tbody>
                </table>
            </ScrollPanel>;
        }

        const SimpleRoomHeader = sdk.getComponent('rooms.SimpleRoomHeader');
        const NetworkDropdown = sdk.getComponent('directory.NetworkDropdown');
        const DirectorySearchBox = sdk.getComponent('elements.DirectorySearchBox');
        return (
            <div className="mx_RoomDirectory">
                <SimpleRoomHeader title="Directory" />
                <div className="mx_RoomDirectory_list">
                    <div className="mx_RoomDirectory_listheader">
                        <DirectorySearchBox
                            className="mx_RoomDirectory_searchbox" ref={this.collectSearchBox}
                            onChange={this.onFilterChange} onClear={this.onFilterClear} onJoinClick={this.onJoinClick}
                        />
                        <NetworkDropdown config={this.props.config} onNetworkChange={this.onNetworkChange} />
                    </div>
                    {content}
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
