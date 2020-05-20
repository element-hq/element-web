/*
Copyright 2017, 2018 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import createReactClass from 'create-react-class';
import TagOrderStore from '../../stores/TagOrderStore';

import GroupActions from '../../actions/GroupActions';

import * as sdk from '../../index';
import dis from '../../dispatcher/dispatcher';
import { _t } from '../../languageHandler';

import { Droppable } from 'react-beautiful-dnd';
import classNames from 'classnames';
import MatrixClientContext from "../../contexts/MatrixClientContext";
import AutoHideScrollbar from "./AutoHideScrollbar";

const TagPanel = createReactClass({
    displayName: 'TagPanel',

    statics: {
        contextType: MatrixClientContext,
    },

    getInitialState() {
        return {
            orderedTags: [],
            selectedTags: [],
        };
    },

    componentDidMount: function() {
        this.unmounted = false;
        this.context.on("Group.myMembership", this._onGroupMyMembership);
        this.context.on("sync", this._onClientSync);

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
        dis.dispatch(GroupActions.fetchJoinedGroups(this.context));
    },

    componentWillUnmount() {
        this.unmounted = true;
        this.context.removeListener("Group.myMembership", this._onGroupMyMembership);
        this.context.removeListener("sync", this._onClientSync);
        if (this._tagOrderStoreToken) {
            this._tagOrderStoreToken.remove();
        }
    },

    _onGroupMyMembership() {
        if (this.unmounted) return;
        dis.dispatch(GroupActions.fetchJoinedGroups(this.context));
    },

    _onClientSync(syncState, prevState) {
        // Consider the client reconnected if there is no error with syncing.
        // This means the state could be RECONNECTING, SYNCING, PREPARED or CATCHUP.
        const reconnected = syncState !== "ERROR" && prevState !== syncState;
        if (reconnected) {
            // Load joined groups
            dis.dispatch(GroupActions.fetchJoinedGroups(this.context));
        }
    },

    onMouseDown(e) {
        // only dispatch if its not a no-op
        if (this.state.selectedTags.length > 0) {
            dis.dispatch({action: 'deselect_tags'});
        }
    },

    onCreateGroupClick(ev) {
        ev.stopPropagation();
        dis.dispatch({action: 'view_create_group'});
    },

    onClearFilterClick(ev) {
        dis.dispatch({action: 'deselect_tags'});
    },

    render() {
        const DNDTagTile = sdk.getComponent('elements.DNDTagTile');
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const ActionButton = sdk.getComponent('elements.ActionButton');
        const TintableSvg = sdk.getComponent('elements.TintableSvg');

        const tags = this.state.orderedTags.map((tag, index) => {
            return <DNDTagTile
                key={tag}
                tag={tag}
                index={index}
                selected={this.state.selectedTags.includes(tag)}
            />;
        });

        const itemsSelected = this.state.selectedTags.length > 0;

        let clearButton;
        if (itemsSelected) {
            clearButton = <AccessibleButton className="mx_TagPanel_clearButton" onClick={this.onClearFilterClick}>
                <TintableSvg src={require("../../../res/img/icons-close.svg")} width="24" height="24"
                             alt={_t("Clear filter")}
                             title={_t("Clear filter")}
                />
            </AccessibleButton>;
        }

        const classes = classNames('mx_TagPanel', {
            mx_TagPanel_items_selected: itemsSelected,
        });

        return <div className={classes}>
            <div className="mx_TagPanel_clearButton_container">
                { clearButton }
            </div>
            <div className="mx_TagPanel_divider" />
            <AutoHideScrollbar
                className="mx_TagPanel_scroller"
                // XXX: Use onMouseDown as a workaround for https://github.com/atlassian/react-beautiful-dnd/issues/273
                // instead of onClick. Otherwise we experience https://github.com/vector-im/riot-web/issues/6253
                onMouseDown={this.onMouseDown}
            >
                <Droppable
                    droppableId="tag-panel-droppable"
                    type="draggable-TagTile"
                >
                    { (provided, snapshot) => (
                            <div
                                className="mx_TagPanel_tagTileContainer"
                                ref={provided.innerRef}
                            >
                                { tags }
                                <div>
                                    <ActionButton
                                        tooltip
                                        label={_t("Communities")}
                                        action="toggle_my_groups"
                                        className="mx_TagTile mx_TagTile_plus" />
                                </div>
                                { provided.placeholder }
                            </div>
                    ) }
                </Droppable>
            </AutoHideScrollbar>
        </div>;
    },
});
export default TagPanel;
