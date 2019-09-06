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
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';

const Avatar = require("../../../Avatar");
const sdk = require('../../../index');

module.exports = createReactClass({
    displayName: 'UserTile',

    propTypes: {
        user: PropTypes.any.isRequired, // User
    },

    render: function() {
        const EntityTile = sdk.getComponent("rooms.EntityTile");
        const user = this.props.user;
        const name = user.displayName || user.userId;
        let active = -1;

        // FIXME: make presence data update whenever User.presence changes...
        active = user.lastActiveAgo ?
            (Date.now() - (user.lastPresenceTs - user.lastActiveAgo)) : -1;

        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        const avatarJsx = (
            <BaseAvatar width={36} height={36} name={name} idName={user.userId}
                        url={Avatar.avatarUrlForUser(user, 36, 36, "crop")} />
        );

        return (
            <EntityTile {...this.props} presenceState={user.presence} presenceActiveAgo={active}
                presenceCurrentlyActive={user.currentlyActive}
                name={name} title={user.userId} avatarJsx={avatarJsx} />
        );
    },
});
