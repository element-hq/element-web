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

import React from 'react';

import MatrixClientPeg from 'matrix-react-sdk/lib/MatrixClientPeg';
import Modal from 'matrix-react-sdk/lib/Modal';
import sdk from 'matrix-react-sdk';
import dis from 'matrix-react-sdk/lib/dispatcher';

import Promise from 'bluebird';

import { _t } from 'matrix-react-sdk/lib/languageHandler';

import {instanceForInstanceId, protocolNameForInstanceId} from '../../utils/DirectoryUtils';

import {getDisplayAliasForRoom} from 'matrix-react-sdk/lib/components/views/rooms/RoomDetailRow';

module.exports = React.createClass({
    displayName: 'RoomDirectory',

    propTypes: {
        config: React.PropTypes.object,
    },

    getDefaultProps: function() {
        return {
            config: {},
        };
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
        };
    },

    componentWillMount: function() {
        this._unmounted = false;
        this.nextBatch = null;
        this.filterTimeout = null;
        this.scrollPanel = null;
        this.protocols = null;

        this.setState({protocolsLoading: true});
        MatrixClientPeg.get().getThirdpartyProtocols().done((response) => {
            this.protocols = response;
            this.setState({protocolsLoading: false});
        }, (err) => {
            console.warn(`error loading thirdparty protocols: ${err}`);
            this.setState({protocolsLoading: false});
            if (MatrixClientPeg.get().isGuest()) {
                // Guests currently aren't allowed to use this API, so
                // ignore this as otherwise this error is literally the
                // thing you see when loading the client!
                return;
            }
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to get protocol list from Home Server', '', ErrorDialog, {
                title: _t('Failed to get protocol list from Home Server'),
                description: _t('The Home Server may be too old to support third party networks'),
            });
        });

        // dis.dispatch({
        //     action: 'panel_disable',
        //     sideDisabled: true,
        //     middleDisabled: true,
        // });
    },

    componentWillUnmount: function() {
        // dis.dispatch({
        //     action: 'panel_disable',
        //     sideDisabled: false,
        //     middleDisabled: false,
        // });
        if (this.filterTimeout) {
            clearTimeout(this.filterTimeout);
        }
        this._unmounted = true;
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
        if (!MatrixClientPeg.get()) return Promise.resolve();

        const myFilterString = this.state.filterString;
        const myServer = this.state.roomServer;
        // remember the next batch token when we sent the request
        // too. If it's changed, appending to the list will corrupt it.
        const myNextBatch = this.nextBatch;
        const opts = {limit: 20};
        if (myServer !== MatrixClientPeg.getHomeServerName()) {
            opts.server = myServer;
        }
        if (this.state.instanceId) {
            opts.third_party_instance_id = this.state.instanceId;
        } else if (this.state.includeAll) {
            opts.include_all_networks = true;
        }
        if (this.nextBatch) opts.since = this.nextBatch;
        if (myFilterString) opts.filter = { generic_search_term: myFilterString };
        return MatrixClientPeg.get().publicRooms(opts).then((data) => {
            if (myFilterString !== this.state.filterString ||
                myServer !== this.state.roomServer ||
                myNextBatch !== this.nextBatch
            ) {
                // if the filter or server has changed since this request was sent,
                // throw away the result (don't even clear the busy flag
                // since we must still have a request in flight)
                return;
            }

            // if we've been unmounted, we don't care either.
            if (this._unmounted) return;

            this.nextBatch = data.next_batch;
            this.setState((s) => {
                s.publicRooms.push(...data.chunk);
                s.loading = false;
                return s;
            });
            return Boolean(data.next_batch);
        }, (err) => {
            if (myFilterString !== this.state.filterString ||
                myServer !== this.state.roomServer ||
                myNextBatch !== this.nextBatch
            ) {
                // as above: we don't care about errors for old
                // requests either
                return;
            }

            // if we've been unmounted, we don't care either.
            if (this._unmounted) return;

            this.setState({ loading: false });
            console.error("Failed to get publicRooms: %s", JSON.stringify(err));
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to get public room list', '', ErrorDialog, {
                title: _t('Failed to get public room list'),
                description: ((err && err.message) ? err.message : _t('The server may be unavailable or overloaded')),
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
        const alias = getDisplayAliasForRoom(room);
        const name = room.name || alias || _t('Unnamed room');

        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");

        let desc;
        if (alias) {
            desc = _t('Delete the room alias %(alias)s and remove %(name)s from the directory?', {alias, name});
        } else {
            desc = _t('Remove %(name)s from the directory?', {name});
        }

        Modal.createTrackedDialog('Remove from Directory', '', QuestionDialog, {
            title: _t('Remove from Directory'),
            description: desc,
            onFinished: (shouldDelete) => {
                if (!shouldDelete) return;

                const Loader = sdk.getComponent("elements.Spinner");
                const modal = Modal.createDialog(Loader);
                let step = _t('remove %(name)s from the directory.', {name});

                MatrixClientPeg.get().setRoomDirectoryVisibility(room.roomId, 'private').then(() => {
                    if (!alias) return;
                    step = _t('delete the alias.');
                    return MatrixClientPeg.get().deleteAlias(alias);
                }).done(() => {
                    modal.close();
                    this.refreshRoomList();
                }, (err) => {
                    modal.close();
                    this.refreshRoomList();
                    console.error("Failed to " + step + ": " + err);
                    Modal.createTrackedDialog('Remove from Directory Error', '', ErrorDialog, {
                        title: _t('Error'),
                        description: ((err && err.message)
                            ? err.message
                            : _t('The server may be unavailable or overloaded')),
                    });
                });
            },
        });
    },

    onRoomClicked: function(ev, room) {
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
        if (backwards || !this.nextBatch) return Promise.resolve(false);

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
            if (alias.indexOf(':') === -1) {
                alias = alias + ':' + this.state.roomServer;
            }
            this.showRoomAlias(alias);
        } else {
            // This is a 3rd party protocol. Let's see if we can join it
            const protocolName = protocolNameForInstanceId(this.protocols, this.state.instanceId);
            const instance = instanceForInstanceId(this.protocols, this.state.instanceId);
            const fields = protocolName
                ? this._getFieldsForThirdPartyLocation(alias, this.protocols[protocolName], instance)
                : null;
            if (!fields) {
                const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createTrackedDialog('Unable to join network', '', ErrorDialog, {
                    title: _t('Unable to join network'),
                    description: _t('Riot does not know how to join a room on this network'),
                });
                return;
            }
            MatrixClientPeg.get().getThirdpartyLocation(protocolName, fields).done((resp) => {
                if (resp.length > 0 && resp[0].alias) {
                    this.showRoomAlias(resp[0].alias);
                } else {
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createTrackedDialog('Room not found', '', ErrorDialog, {
                        title: _t('Room not found'),
                        description: _t('Couldn\'t find a matching Matrix room'),
                    });
                }
            }, () => {
                const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createTrackedDialog('Fetching third party location failed', '', ErrorDialog, {
                    title: _t('Fetching third party location failed'),
                    description: _t('Unable to look up room ID from server'),
                });
            });
        }
    },

    showRoomAlias: function(alias) {
        this.showRoom(null, alias);
    },

    showRoom: function(room, roomAlias) {
        const payload = {action: 'view_room'};
        if (room) {
            // Don't let the user view a room they won't be able to either
            // peek or join: fail earlier so they don't have to click back
            // to the directory.
            if (MatrixClientPeg.get().isGuest()) {
                if (!room.worldReadable && !room.guestCanJoin) {
                    dis.dispatch({action: 'view_set_mxid'});
                    return;
                }
            }

            if (!roomAlias) {
                roomAlias = getDisplayAliasForRoom(room);
            }

            payload.oob_data = {
                avatarUrl: room.avatarUrl,
                // XXX: This logic is duplicated from the JS SDK which
                // would normally decide what the name is.
                name: room.name || roomAlias || _t('Unnamed room'),
            };
        }
        // It's not really possible to join Matrix rooms by ID because the HS has no way to know
        // which servers to start querying. However, there's no other way to join rooms in
        // this list without aliases at present, so if roomAlias isn't set here we have no
        // choice but to supply the ID.
        if (roomAlias) {
            payload.room_alias = roomAlias;
        } else {
            payload.room_id = room.roomId;
        }
        dis.dispatch(payload);
    },

    onRoomMouseDown: function(ev) {
        ev.preventDefault();
    },

    getRows: function() {
        const rooms = this.state.publicRooms;
        if (!rooms) return [];

        const RoomDetailRow = sdk.getComponent('rooms.RoomDetailRow');
        return rooms.map((roomDictRoom) => {
            const room = mapRoomDirectoryRoomObject(roomDictRoom);
            return <RoomDetailRow key={room.roomId}
                                  room={room}
                                  onClick={this.onRoomClicked}
                                  onMouseDown={this.onRoomMouseDown} />;
        });
    },

    collectScrollPanel: function(element) {
        this.scrollPanel = element;
    },

    _stringLooksLikeId: function(s, fieldType) {
        let pat = /^#[^\s]+:[^\s]/;
        if (fieldType && fieldType.regexp) {
            pat = new RegExp(fieldType.regexp);
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
                    <SimpleRoomHeader title={_t('Directory')} />
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
            let scrollpanelContent;
            if (rows.length === 0) {
                scrollpanelContent = <i>{ _t('No rooms to show') }</i>;
            } else {
                scrollpanelContent = <table ref="directory_table" className="mx_RoomDirectory_table">
                    <tbody>
                        { rows }
                    </tbody>
                </table>;
            }
            const ScrollPanel = sdk.getComponent("structures.ScrollPanel");
            content = <ScrollPanel ref={this.collectScrollPanel}
                className="mx_RoomDirectory_tableWrapper"
                onFillRequest={this.onFillRequest}
                stickyBottom={false}
                startAtBottom={false}
                onResize={null}
            >
                { scrollpanelContent }
            </ScrollPanel>;
        }

        const protocolName = protocolNameForInstanceId(this.protocols, this.state.instanceId);
        let instanceExpectedFieldType;
        if (protocolName &&
            this.protocols &&
            this.protocols[protocolName] &&
            this.protocols[protocolName].location_fields.length > 0 &&
            this.protocols[protocolName].field_types
        ) {
            const lastField = this.protocols[protocolName].location_fields.slice(-1)[0];
            instanceExpectedFieldType = this.protocols[protocolName].field_types[lastField];
        }


        let placeholder = _t('Search for a room');
        if (!this.state.instanceId) {
            placeholder = _t('#example') + ':' + this.state.roomServer;
        } else if (instanceExpectedFieldType) {
            placeholder = instanceExpectedFieldType.placeholder;
        }

        const filterString = this.state.filterString;
        let showJoinButton = this._stringLooksLikeId(filterString, instanceExpectedFieldType);
        if (protocolName) {
            const instance = instanceForInstanceId(this.protocols, this.state.instanceId);
            if (this._getFieldsForThirdPartyLocation(filterString, this.protocols[protocolName], instance) === null) {
                showJoinButton = false;
            }
        }

        const NetworkDropdown = sdk.getComponent('directory.NetworkDropdown');
        const DirectorySearchBox = sdk.getComponent('elements.DirectorySearchBox');
        return (
            <div className="mx_RoomDirectory">
                <SimpleRoomHeader title={_t('Directory')} icon="img/icons-directory.svg" />
                <div className="mx_RoomDirectory_list">
                    <div className="mx_RoomDirectory_listheader">
                        <DirectorySearchBox
                            className="mx_RoomDirectory_searchbox"
                            onChange={this.onFilterChange} onClear={this.onFilterClear} onJoinClick={this.onJoinClick}
                            placeholder={placeholder} showJoinButton={showJoinButton}
                        />
                        <NetworkDropdown config={this.props.config} protocols={this.protocols} onOptionChange={this.onOptionChange} />
                    </div>
                    { content }
                </div>
            </div>
        );
    },
});

function mapRoomDirectoryRoomObject(room) {
    return {
        name: room.name,
        topic: room.topic,
        roomId: room.room_id,
        avatarUrl: room.avatar_url,
        numJoinedMembers: room.num_joined_members,
        canonicalAlias: room.canonical_alias,
        aliases: room.aliases,

        worldReadable: room.world_readable,
        guestCanJoin: room.guest_can_join,
    };
}
