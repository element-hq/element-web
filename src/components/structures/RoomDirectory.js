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

var linkify = require('linkifyjs');
var linkifyString = require('linkifyjs/string');
var linkifyMatrix = require('matrix-react-sdk/lib/linkify-matrix');
var sanitizeHtml = require('sanitize-html');
var q = require('q');

import {instanceForInstanceId, protocolNameForInstanceId} from '../../utils/DirectoryUtils';

linkifyMatrix(linkify);

module.exports = React.createClass({
    displayName: 'RoomDirectory',

    propTypes: {
        config: React.PropTypes.object,
    },

    getDefaultProps: function() {
        return {
            config: {},
        }
    },

    getInitialState: function() {
        return {
            publicRooms: [],
            loading: true,
            protocolsLoading: true,
            instanceId: null,
            includeAll: false,
            roomServer: null,
            filterString: null,
        }
    },

    componentWillMount: function() {
        this.nextBatch = null;
        this.filterTimeout = null;
        this.scrollPanel = null;
        this.protocols = null;

        this.setState({protocolsLoading: true});
        MatrixClientPeg.get().getThirdpartyProtocols().done((response) => {
            this.protocols = response;
            this.setState({protocolsLoading: false});
        }, (err) => {
            this.setState({protocolsLoading: false});
            if (MatrixClientPeg.get().isGuest()) {
                // Guests currently aren't allowed to use this API, so
                // ignore this as otherwise this error is literally the
                // thing you see when loading the client!
                return;
            }
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Failed to get protocol list from Home Server",
                description: "The Home Server may be too old to support third party networks",
            });
        });

        // dis.dispatch({
        //     action: 'ui_opacity',
        //     sideOpacity: 0.3,
        //     middleOpacity: 0.3,
        // });
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

        const my_filter_string = this.state.filterString;
        const my_server = this.state.roomServer;
        // remember the next batch token when we sent the request
        // too. If it's changed, appending to the list will corrupt it.
        const my_next_batch = this.nextBatch;
        const opts = {limit: 20};
        if (my_server != MatrixClientPeg.getHomeServerName()) {
            opts.server = my_server;
        }
        if (this.state.instanceId) {
            opts.third_party_instance_id = this.state.instanceId;
        } else if (this.state.includeAll) {
            opts.include_all_networks = true;
        }
        if (this.nextBatch) opts.since = this.nextBatch;
        if (my_filter_string) opts.filter = { generic_search_term: my_filter_string } ;
        return MatrixClientPeg.get().publicRooms(opts).then((data) => {
            if (
                my_filter_string != this.state.filterString ||
                my_server != this.state.roomServer ||
                my_next_batch != this.nextBatch)
            {
                // if the filter or server has changed since this request was sent,
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
            if (
                my_filter_string != this.state.filterString ||
                my_server != this.state.roomServer ||
                my_next_batch != this.nextBatch)
            {
                // as above: we don't care about errors for old
                // requests either
                return;
            }
            this.setState({ loading: false });
            console.error("Failed to get publicRooms: %s", JSON.stringify(err));
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Failed to get public room list",
                description: ((err && err.message) ? err.message : "The server may be unavailable or overloaded"),
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
                }, (err) => {
                    modal.close();
                    this.refreshRoomList();
                    console.error("Failed to " + step + ": " + err);
                    Modal.createDialog(ErrorDialog, {
                        title: "Failed to " + step,
                        description: ((err && err.message) ? err.message : "The server may be unavailable or overloaded"),
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

    onOptionChange: function(server, instanceId, includeAll) {
        // clear next batch so we don't try to load more rooms
        this.nextBatch = null;
        this.setState({
            // Clear the public rooms out here otherwise we needlessly
            // spend time filtering lots of rooms when we're about to
            // to clear the list anyway.
            publicRooms: [],
            roomServer: server,
            instanceId: instanceId,
            includeAll: includeAll,
        }, this.refreshRoomList);
        // We also refresh the room list each time even though this
        // filtering is client-side. It hopefully won't be client side
        // for very long, and we may have fetched a thousand rooms to
        // find the five gitter ones, at which point we do not want
        // to render all those rooms when switching back to 'all networks'.
        // Easiest to just blow away the state & re-fetch.
    },

    onFillRequest: function(backwards) {
        if (backwards || !this.nextBatch) return q(false);

        return this.getMoreRooms();
    },

    onFilterChange: function(alias) {
        this.setState({
            filterString: alias || null,
        });

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
        }, 700);
    },

    onFilterClear: function() {
        // update immediately
        this.setState({
            filterString: null,
        }, this.refreshRoomList);

        if (this.filterTimeout) {
            clearTimeout(this.filterTimeout);
        }
    },

    onJoinClick: function(alias) {
        // If we don't have a particular instance id selected, just show that rooms alias
        if (!this.state.instanceId) {
            // If the user specified an alias without a domain, add on whichever server is selected
            // in the dropdown
            if (alias.indexOf(':') == -1) {
                alias = alias + ':' + this.state.roomServer;
            }
            this.showRoomAlias(alias);
        } else {
            // This is a 3rd party protocol. Let's see if we can join it
            const protocolName = protocolNameForInstanceId(this.protocols, this.state.instanceId);
            const instance = instanceForInstanceId(this.protocols, this.state.instanceId);
            const fields = protocolName ? this._getFieldsForThirdPartyLocation(alias, this.protocols[protocolName], instance) : null;
            if (!fields) {
                const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: "Unable to join network",
                    description: "Riot does not know how to join a room on this network",
                });
                return;
            }
            MatrixClientPeg.get().getThirdpartyLocation(protocolName, fields).done((resp) => {
                if (resp.length > 0 && resp[0].alias) {
                    this.showRoomAlias(resp[0].alias);
                } else {
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createDialog(ErrorDialog, {
                        title: "Room not found",
                        description: "Couldn't find a matching Matrix room",
                    });
                }
            }, (e) => {
                const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: "Fetching third party location failed",
                    description: "Unable to look up room ID from server",
                });
            });
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
                    dis.dispatch({action: 'view_set_mxid'});
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

        var rooms = this.state.publicRooms;
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

    _stringLooksLikeId: function(s, field_type) {
        let pat = /^#[^\s]+:[^\s]/;
        if (field_type && field_type.regexp) {
            pat = new RegExp(field_type.regexp);
        }

        return pat.test(s);
    },

    _getFieldsForThirdPartyLocation: function(userInput, protocol, instance) {
        // make an object with the fields specified by that protocol. We
        // require that the values of all but the last field come from the
        // instance. The last is the user input.
        const requiredFields = protocol.location_fields;
        if (!requiredFields) return null;
        const fields = {};
        for (let i = 0; i < requiredFields.length - 1; ++i) {
            const thisField = requiredFields[i];
            if (instance.fields[thisField] === undefined) return null;
            fields[thisField] = instance.fields[thisField];
        }
        fields[requiredFields[requiredFields.length - 1]] = userInput;
        return fields;
    },

    /**
     * called by the parent component when PageUp/Down/etc is pressed.
     *
     * We pass it down to the scroll panel.
     */
    handleScrollKey: function(ev) {
        if (this.scrollPanel) {
            this.scrollPanel.handleScrollKey(ev);
        }
    },

    render: function() {
        const SimpleRoomHeader = sdk.getComponent('rooms.SimpleRoomHeader');
        const Loader = sdk.getComponent("elements.Spinner");

        if (this.state.protocolsLoading) {
            return (
                <div className="mx_RoomDirectory">
                    <SimpleRoomHeader title="Directory" />
                    <Loader />
                </div>
            );
        }

        let content;
        if (this.state.loading) {
            content = <div className="mx_RoomDirectory">
                <Loader />
            </div>;
        } else {
            const rows = this.getRows();
            // we still show the scrollpanel, at least for now, because
            // otherwise we don't fetch more because we don't get a fill
            // request from the scrollpanel because there isn't one
            let scrollpanel_content;
            if (rows.length == 0) {
                scrollpanel_content = <i>No rooms to show</i>;
            } else {
                scrollpanel_content = <table ref="directory_table" className="mx_RoomDirectory_table">
                    <tbody>
                        { this.getRows() }
                    </tbody>
                </table>;
            }
            const ScrollPanel = sdk.getComponent("structures.ScrollPanel");
            content = <ScrollPanel ref={this.collectScrollPanel}
                className="mx_RoomDirectory_tableWrapper"
                onFillRequest={ this.onFillRequest }
                stickyBottom={false}
                startAtBottom={false}
                onResize={function(){}}
            >
                { scrollpanel_content }
            </ScrollPanel>;
        }

        const protocolName = protocolNameForInstanceId(this.protocols, this.state.instanceId);
        let instance_expected_field_type;
        if (
            protocolName &&
            this.protocols &&
            this.protocols[protocolName] &&
            this.protocols[protocolName].location_fields.length > 0 &&
            this.protocols[protocolName].field_types
        ) {
            const last_field = this.protocols[protocolName].location_fields.slice(-1)[0];
            instance_expected_field_type = this.protocols[protocolName].field_types[last_field];
        }


        let placeholder = 'Search for a room';
        if (!this.state.instanceId) {
            placeholder = '#example:' + this.state.roomServer;
        } else if (instance_expected_field_type) {
            placeholder = instance_expected_field_type.placeholder;
        }

        let showJoinButton = this._stringLooksLikeId(this.state.filterString, instance_expected_field_type);
        if (protocolName) {
            const instance = instanceForInstanceId(this.protocols, this.state.instanceId);
            if (this._getFieldsForThirdPartyLocation(this.state.filterString, this.protocols[protocolName], instance) === null) {
                showJoinButton = false;
            }
        }

        const NetworkDropdown = sdk.getComponent('directory.NetworkDropdown');
        const DirectorySearchBox = sdk.getComponent('elements.DirectorySearchBox');
        return (
            <div className="mx_RoomDirectory">
                <SimpleRoomHeader title="Directory" icon="img/icons-directory.svg"/>
                <div className="mx_RoomDirectory_list">
                    <div className="mx_RoomDirectory_listheader">
                        <DirectorySearchBox
                            className="mx_RoomDirectory_searchbox"
                            onChange={this.onFilterChange} onClear={this.onFilterClear} onJoinClick={this.onJoinClick}
                            placeholder={placeholder} showJoinButton={showJoinButton}
                        />
                        <NetworkDropdown config={this.props.config} protocols={this.protocols} onOptionChange={this.onOptionChange} />
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
