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
import React from 'react';
import sdk from '../../../index';
import Entities from '../../../Entities';
import MatrixClientPeg from '../../../MatrixClientPeg';
import rate_limited_func from '../../../ratelimitedfunc';

const INITIAL_SEARCH_RESULTS_COUNT = 10;

module.exports = React.createClass({
    displayName: 'InviteMemberList',

    propTypes: {
        roomId: React.PropTypes.string.isRequired,
        onInvite: React.PropTypes.func.isRequired, // fn(inputText)
        onThirdPartyInvite: React.PropTypes.func.isRequired, // fn(inputText)
        onSearchQueryChanged: React.PropTypes.func // fn(inputText)
    },

    getDefaultProps: function() {
        return {
            onSearchQueryChanged: function() {}
        };
    },

    componentWillMount: function() {
        var cli = MatrixClientPeg.get();
        cli.on("RoomState.members", this.onRoomStateMember);

        this._emailEntity = null;

        // we have to update the list whenever membership changes
        // particularly to avoid bug https://github.com/vector-im/vector-web/issues/1813
        this._updateList();
    },

    componentDidMount: function() {
        // initialise the email tile
        this.onSearchQueryChanged('');
    },

    componentWillUnmount: function() {
        var cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener("RoomState.members", this.onRoomStateMember);
        }
    },

    _updateList: new rate_limited_func(function() {
        this._room = MatrixClientPeg.get().getRoom(this.props.roomId);
        // Load the complete user list for inviting new users
        if (this._room) {
            this._userList = MatrixClientPeg.get().getUsers().filter((u) => {
                return (!this._room.hasMembershipState(u.userId, "join") &&
                        !this._room.hasMembershipState(u.userId, "invite"));
            });
        }
    }, 500),

    onRoomStateMember: function(ev, state, member) {
        this._updateList();
    },

    onInvite: function(ev) {
        this.props.onInvite(this._input);
    },

    onThirdPartyInvite: function(ev) {
        this.props.onThirdPartyInvite(this._input);
    },

    onSearchQueryChanged: function(input) {
        this._input = input;
        var EntityTile = sdk.getComponent("rooms.EntityTile");
        var BaseAvatar = sdk.getComponent("avatars.BaseAvatar");

        var label = input;
        // if (input[0] === "@") {
        //     label = input;
        // }
        // else {
        //     label = "Email: " + input;
        // }

        this._emailEntity = new Entities.newEntity(
            <EntityTile key="dynamic_invite_tile" suppressOnHover={true} showInviteButton={true}
                avatarJsx={ <BaseAvatar name="@" width={36} height={36} /> }
                className="mx_EntityTile_invitePlaceholder"
                presenceState="online" onClick={this.onThirdPartyInvite} name={"Invite by email"} 
            />,
            function(query) {
                return true; // always show this
            }
        );

        this.props.onSearchQueryChanged(input);
    },

    render: function() {
        var SearchableEntityList = sdk.getComponent("rooms.SearchableEntityList");
        var entities = Entities.fromUsers(this._userList || [], true, this.props.onInvite);

        // Add an "Email: foo@bar.com" tile as the first tile
        if (this._emailEntity) {
            entities.unshift(this._emailEntity);
        }

        return (
            <SearchableEntityList searchPlaceholderText={"Search/invite by name, email, id"}
                onSubmit={this.props.onInvite}
                onQueryChanged={this.onSearchQueryChanged}
                entities={entities}
                truncateAt={INITIAL_SEARCH_RESULTS_COUNT}/>
        );
    }
});
