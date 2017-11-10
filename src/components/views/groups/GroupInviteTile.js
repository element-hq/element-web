/*
Copyright 2017 New Vector Ltd

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
import { MatrixClient } from 'matrix-js-sdk';
import sdk from '../../../index';
import dis from '../../../dispatcher';
import AccessibleButton from '../elements/AccessibleButton';

export default React.createClass({
    displayName: 'GroupInviteTile',

    propTypes: {
        group: PropTypes.object.isRequired,
    },

    contextTypes: {
        matrixClient: PropTypes.instanceOf(MatrixClient),
    },

    onClick: function(e) {
        dis.dispatch({
            action: 'view_group',
            group_id: this.props.group.groupId,
        });
    },

    render: function() {
        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        const EmojiText = sdk.getComponent('elements.EmojiText');

        const groupName = this.props.group.name || this.props.group.groupId;
        const httpAvatarUrl = this.props.group.avatarUrl ?
            this.context.matrixClient.mxcUrlToHttp(this.props.group.avatarUrl, 24, 24) : null;

        const av = <BaseAvatar name={groupName} width={24} height={24} url={httpAvatarUrl} />;

        const label = <EmojiText
            element="div"
            title={this.props.group.groupId}
            className="mx_RoomTile_name mx_RoomTile_badgeShown"
            dir="auto"
        >
            { groupName }
        </EmojiText>;

        const badge = <div className="mx_RoomSubList_badge mx_RoomSubList_badgeHighlight">!</div>;

        return (
            <AccessibleButton className="mx_RoomTile mx_RoomTile_highlight" onClick={this.onClick}>
                <div className="mx_RoomTile_avatar">
                    { av }
                </div>
                <div className="mx_RoomTile_nameContainer">
                    { label }
                    { badge }
                </div>
            </AccessibleButton>
        );
    },
});
