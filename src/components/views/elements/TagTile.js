/*
Copyright 2017 New Vector Ltd.

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
import classNames from 'classnames';
import { MatrixClient } from 'matrix-js-sdk';
import sdk from '../../../index';
import dis from '../../../dispatcher';
import { isOnlyCtrlOrCmdKeyEvent } from '../../../Keyboard';

import FlairStore from '../../../stores/FlairStore';

export default React.createClass({
    displayName: 'TagTile',

    propTypes: {
        tag: PropTypes.string,
    },

    contextTypes: {
        matrixClient: React.PropTypes.instanceOf(MatrixClient).isRequired,
    },

    componentWillMount() {
        this.unmounted = false;
        if (this.props.tag[0] === '+') {
            FlairStore.getGroupProfileCached(
                this.context.matrixClient,
                this.props.tag,
            ).then((profile) => {
                if (this.unmounted) return;
                this.setState({profile});
            });
        }
    },

    componentWillUnmount() {
        this.unmounted = true;
    },

    getInitialState() {
        return {
            hover: false,
        };
    },

    onClick: function(e) {
        e.preventDefault();
        e.stopPropagation();
        dis.dispatch({
            action: 'select_tag',
            tag: this.props.tag,
            ctrlOrCmdKey: isOnlyCtrlOrCmdKeyEvent(e),
            shiftKey: e.shiftKey,
        });
    },

    onMouseOver: function() {
        this.setState({hover: true});
    },

    onMouseOut: function() {
        this.setState({hover: false});
    },

    render: function() {
        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const RoomTooltip = sdk.getComponent('rooms.RoomTooltip');
        const profile = this.state.profile || {};
        const name = profile.name || this.props.tag;
        const avatarHeight = 35;

        const httpUrl = profile.avatarUrl ? this.context.matrixClient.mxcUrlToHttp(
            profile.avatarUrl, avatarHeight, avatarHeight, "crop",
        ) : null;

        const className = classNames({
            mx_TagTile: true,
            mx_TagTile_selected: this.props.selected,
        });

        const tip = this.state.hover ?
            <RoomTooltip className="mx_TagTile_tooltip" label={name} /> :
            <div />;
        return <AccessibleButton className={className} onClick={this.onClick}>
            <div className="mx_TagTile_avatar" onMouseOver={this.onMouseOver} onMouseOut={this.onMouseOut}>
                <BaseAvatar name={name} url={httpUrl} width={avatarHeight} height={avatarHeight} />
                { tip }
            </div>
        </AccessibleButton>;
    },
});
