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

var Avatar = require("../../../Avatar");
var MatrixClientPeg = require('../../../MatrixClientPeg');
var sdk = require('../../../index');
var dis = require('../../../dispatcher');
var Modal = require("../../../Modal");

module.exports = React.createClass({
    displayName: 'UserTile',

    propTypes: {
        user: React.PropTypes.any.isRequired // User
    },

    render: function() {
        var EntityTile = sdk.getComponent("rooms.EntityTile");
        var user = this.props.user;
        var name = user.displayName || user.userId;
        var active = -1;

        // FIXME: make presence data update whenever User.presence changes...
        active = (
            (Date.now() - (user.lastPresenceTs - user.lastActiveAgo)) || -1
        );

        var BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        var avatarJsx = (
            <BaseAvatar width={36} height={36} name={name} idName={user.userId}
                        url={ Avatar.avatarUrlForUser(user, 36, 36, "crop") } />
        );

        return (
            <EntityTile {...this.props} presenceState={user.presence} presenceActiveAgo={active}
                name={name} title={user.userId} avatarJsx={avatarJsx} />
        );
    }
});
