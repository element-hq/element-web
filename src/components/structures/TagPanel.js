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
import { MatrixClient } from 'matrix-js-sdk';
import FilterStore from '../../stores/FilterStore';
import FlairStore from '../../stores/FlairStore';
import TagOrderStore from '../../stores/TagOrderStore';
import sdk from '../../index';
import dis from '../../dispatcher';

const TagPanel = React.createClass({
    displayName: 'TagPanel',

    contextTypes: {
        matrixClient: PropTypes.instanceOf(MatrixClient),
    },

    getInitialState() {
        return {
            joinedGroupProfiles: [],
            selectedTags: [],
        };
    },

    componentWillMount: function() {
        this.unmounted = false;
        this.context.matrixClient.on("Group.myMembership", this._onGroupMyMembership);

        this._filterStoreToken = FilterStore.addListener(() => {
            if (this.unmounted) {
                return;
            }
            this.setState({
                selectedTags: FilterStore.getSelectedTags(),
            });
        });
        this._tagOrderStoreToken = TagOrderStore.addListener(() => {
            if (this.unmounted) {
                return;
            }
            this.setState({
                orderedTags: TagOrderStore.getOrderedTags(),
            });
        });

        this._fetchJoinedRooms();
    },

    componentWillUnmount() {
        this.unmounted = true;
        this.context.matrixClient.removeListener("Group.myMembership", this._onGroupMyMembership);
        if (this._filterStoreToken) {
            this._filterStoreToken.remove();
        }
    },

    _onGroupMyMembership() {
        if (this.unmounted) return;
        this._fetchJoinedRooms();
    },

    onClick() {
        dis.dispatch({action: 'deselect_tags'});
    },

    onCreateGroupClick(ev) {
        ev.stopPropagation();
        dis.dispatch({action: 'view_create_group'});
    },

    async _fetchJoinedRooms() {
        const joinedGroupResponse = await this.context.matrixClient.getJoinedGroups();
        const joinedGroupIds = joinedGroupResponse.groups;
        const joinedGroupProfiles = await Promise.all(joinedGroupIds.map(
            (groupId) => FlairStore.getGroupProfileCached(this.context.matrixClient, groupId),
        ));
        dis.dispatch({
            action: 'all_tags',
            tags: joinedGroupIds,
        });
        this.setState({joinedGroupProfiles});
    },

    render() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const TintableSvg = sdk.getComponent('elements.TintableSvg');
        const DNDTagTile = sdk.getComponent('elements.DNDTagTile');

        const orderedGroupProfiles = this.state.orderedTags ?
            this.state.joinedGroupProfiles.sort((a, b) =>
                this.state.orderedTags.indexOf(a.groupId) -
                this.state.orderedTags.indexOf(b.groupId),
            ) : this.state.joinedGroupProfiles;

        const tags = orderedGroupProfiles.map((groupProfile, index) => {
            return <DNDTagTile
                key={groupProfile.groupId + '_' + index}
                groupProfile={groupProfile}
                selected={this.state.selectedTags.includes(groupProfile.groupId)}
            />;
        });
        return <div className="mx_TagPanel" onClick={this.onClick}>
            <div className="mx_TagPanel_tagTileContainer">
                { tags }
            </div>
            <AccessibleButton className="mx_TagPanel_createGroupButton" onClick={this.onCreateGroupClick}>
                <TintableSvg src="img/icons-create-room.svg" width="25" height="25" />
            </AccessibleButton>
        </div>;
    },
});
export default TagPanel;
