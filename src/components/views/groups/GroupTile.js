/*
Copyright 2017 Vector Creations Ltd

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
import {MatrixClient} from 'matrix-js-sdk';
import { Draggable } from 'react-beautiful-dnd';
import sdk from '../../../index';
import dis from '../../../dispatcher';
import FlairStore from '../../../stores/FlairStore';


const GroupTile = React.createClass({
    displayName: 'GroupTile',

    propTypes: {
        groupId: PropTypes.string.isRequired,
        // Whether to show the short description of the group on the tile
        showDescription: PropTypes.bool,
        // Height of the group avatar in pixels
        avatarHeight: PropTypes.number,
    },

    contextTypes: {
        matrixClient: PropTypes.instanceOf(MatrixClient).isRequired,
    },

    getInitialState() {
        return {
            profile: null,
        };
    },

    getDefaultProps() {
        return {
            showDescription: true,
            avatarHeight: 50,
        };
    },

    componentWillMount: function() {
        FlairStore.getGroupProfileCached(this.context.matrixClient, this.props.groupId).then((profile) => {
            this.setState({profile});
        }).catch((err) => {
            console.error('Error whilst getting cached profile for GroupTile', err);
        });
    },

    onClick: function(e) {
        e.preventDefault();
        dis.dispatch({
            action: 'view_group',
            group_id: this.props.groupId,
        });
    },

    render: function() {
        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const profile = this.state.profile || {};
        const name = profile.name || this.props.groupId;
        const avatarHeight = this.props.avatarHeight;
        const descElement = this.props.showDescription ?
            <div className="mx_GroupTile_desc">{ profile.shortDescription }</div> :
            <div />;
        const httpUrl = profile.avatarUrl ? this.context.matrixClient.mxcUrlToHttp(
            profile.avatarUrl, avatarHeight, avatarHeight, "crop",
        ) : null;
        return <AccessibleButton className="mx_GroupTile" onClick={this.onClick}>
            <Draggable
                key={"GroupTile " + this.props.groupId}
                draggableId={"GroupTile " + this.props.groupId}
                index={this.props.groupId}
                type="draggable-TagTile"
            >
                { (provided, snapshot) => (
                    <div>
                        <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                        >
                            <div className="mx_GroupTile_avatar">
                                <BaseAvatar name={name} url={httpUrl} width={avatarHeight} height={avatarHeight} />
                            </div>
                        </div>
                        { /* Instead of a blank placeholder, use a copy of the avatar itself. */ }
                        { provided.placeholder ?
                            <div className="mx_GroupTile_avatar">
                                <BaseAvatar name={name} url={httpUrl} width={avatarHeight} height={avatarHeight} />
                            </div> :
                            <div />
                        }
                    </div>
                ) }
            </Draggable>
            <div className="mx_GroupTile_profile">
                <div className="mx_GroupTile_name">{ name }</div>
                { descElement }
                <div className="mx_GroupTile_groupId">{ this.props.groupId }</div>
            </div>
        </AccessibleButton>;
    },
});

export default GroupTile;
