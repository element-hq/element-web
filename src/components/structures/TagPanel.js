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

import GroupActions from '../../actions/GroupActions';
import TagOrderActions from '../../actions/TagOrderActions';

import sdk from '../../index';
import dis from '../../dispatcher';

const TagPanel = React.createClass({
    displayName: 'TagPanel',

    contextTypes: {
        matrixClient: PropTypes.instanceOf(MatrixClient),
    },

    getInitialState() {
        return {
            // A list of group profiles for tags that are group IDs. The intention in future
            // is to allow arbitrary tags to be selected in the TagPanel, not just groups.
            // For now, it suffices to maintain a list of ordered group profiles.
            orderedGroupTagProfiles: [
            // {
            //     groupId: '+awesome:foo.bar',{
            //     name: 'My Awesome Community',
            //     avatarUrl: 'mxc://...',
            //     shortDescription: 'Some description...',
            // },
            ],
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

            const orderedTags = TagOrderStore.getOrderedTags() || [];
            const orderedGroupTags = orderedTags.filter((t) => t[0] === '+');
            // XXX: One profile lookup failing will bring the whole lot down
            Promise.all(orderedGroupTags.map(
                (groupId) => FlairStore.getGroupProfileCached(this.context.matrixClient, groupId),
            )).then((orderedGroupTagProfiles) => {
                if (this.unmounted) return;
                this.setState({orderedGroupTagProfiles});
            });
        });
        // This could be done by anything with a matrix client
        dis.dispatch(GroupActions.fetchJoinedGroups(this.context.matrixClient));
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
        dis.dispatch(GroupActions.fetchJoinedGroups(this.context.matrixClient));
    },

    onClick() {
        dis.dispatch({action: 'deselect_tags'});
    },

    onCreateGroupClick(ev) {
        ev.stopPropagation();
        dis.dispatch({action: 'view_create_group'});
    },

    onTagTileEndDrag() {
        dis.dispatch(TagOrderActions.commitTagOrdering(this.context.matrixClient));
    },

    render() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const TintableSvg = sdk.getComponent('elements.TintableSvg');
        const DNDTagTile = sdk.getComponent('elements.DNDTagTile');

        const tags = this.state.orderedGroupTagProfiles.map((groupProfile, index) => {
            return <DNDTagTile
                key={groupProfile.groupId + '_' + index}
                groupProfile={groupProfile}
                selected={this.state.selectedTags.includes(groupProfile.groupId)}
                onEndDrag={this.onTagTileEndDrag}
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
