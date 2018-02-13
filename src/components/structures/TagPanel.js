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
import TagOrderStore from '../../stores/TagOrderStore';

import GroupActions from '../../actions/GroupActions';
import TagOrderActions from '../../actions/TagOrderActions';

import sdk from '../../index';
import dis from '../../dispatcher';

import { DragDropContext, Droppable } from 'react-beautiful-dnd';

const TagPanel = React.createClass({
    displayName: 'TagPanel',

    contextTypes: {
        matrixClient: PropTypes.instanceOf(MatrixClient),
    },

    getInitialState() {
        return {
            orderedTags: [],
            selectedTags: [],
        };
    },

    componentWillMount: function() {
        this.unmounted = false;
        this.context.matrixClient.on("Group.myMembership", this._onGroupMyMembership);
        this.context.matrixClient.on("sync", this.onClientSync);

        this._tagOrderStoreToken = TagOrderStore.addListener(() => {
            if (this.unmounted) {
                return;
            }
            this.setState({
                orderedTags: TagOrderStore.getOrderedTags() || [],
                selectedTags: TagOrderStore.getSelectedTags(),
            });
        });
        // This could be done by anything with a matrix client
        dis.dispatch(GroupActions.fetchJoinedGroups(this.context.matrixClient));
    },

    componentWillUnmount() {
        this.unmounted = true;
        this.context.matrixClient.removeListener("Group.myMembership", this._onGroupMyMembership);
        this.context.matrixClient.removeListener("sync", this.onClientSync);
        if (this._filterStoreToken) {
            this._filterStoreToken.remove();
        }
    },

    _onGroupMyMembership() {
        if (this.unmounted) return;
        dis.dispatch(GroupActions.fetchJoinedGroups(this.context.matrixClient));
    },

    onClientSync(syncState, prevState) {
        // Consider the client reconnected if there is no error with syncing.
        // This means the state could be RECONNECTING, SYNCING or PREPARED.
        const reconnected = syncState !== "ERROR" && prevState !== syncState;
        if (reconnected) {
            // Load joined groups
            dis.dispatch(GroupActions.fetchJoinedGroups(this.context.matrixClient));
        }
    },

    onClick(e) {
        // Ignore clicks on children
        if (e.target !== e.currentTarget) return;
        dis.dispatch({action: 'deselect_tags'});
    },

    onCreateGroupClick(ev) {
        ev.stopPropagation();
        dis.dispatch({action: 'view_create_group'});
    },

    onTagTileEndDrag(result) {
        // Dragged to an invalid destination, not onto a droppable
        if (!result.destination) {
            return;
        }

        // Dispatch synchronously so that the TagPanel receives an
        // optimistic update from TagOrderStore before the previous
        // state is shown.
        dis.dispatch(TagOrderActions.moveTag(
            this.context.matrixClient,
            result.draggableId,
            result.destination.index,
        ), true);
    },

    render() {
        const GroupsButton = sdk.getComponent('elements.GroupsButton');
        const DNDTagTile = sdk.getComponent('elements.DNDTagTile');

        const tags = this.state.orderedTags.map((tag, index) => {
            return <DNDTagTile
                key={tag}
                tag={tag}
                index={index}
                selected={this.state.selectedTags.includes(tag)}
            />;
        });
        return <div className="mx_TagPanel">
            <DragDropContext onDragEnd={this.onTagTileEndDrag}>
                <Droppable droppableId="tag-panel-droppable">
                    { (provided, snapshot) => (
                        <div
                            className="mx_TagPanel_tagTileContainer"
                            ref={provided.innerRef}
                            // react-beautiful-dnd has a bug that emits a click to the parent
                            // of draggables upon dropping
                            //   https://github.com/atlassian/react-beautiful-dnd/issues/273
                            // so we use onMouseDown here as a workaround.
                            onMouseDown={this.onClick}
                        >
                            { tags }
                            { provided.placeholder }
                        </div>
                    ) }
                </Droppable>
            </DragDropContext>
            <div className="mx_TagPanel_createGroupButton">
                <GroupsButton tooltip={true} />
            </div>
        </div>;
    },
});
export default TagPanel;
