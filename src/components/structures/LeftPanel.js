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

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { DragDropContext } from 'react-beautiful-dnd';
import { MatrixClient } from 'matrix-js-sdk';
import { KeyCode } from 'matrix-react-sdk/lib/Keyboard';
import sdk from 'matrix-react-sdk';
import dis from 'matrix-react-sdk/lib/dispatcher';
import VectorConferenceHandler from '../../VectorConferenceHandler';

import SettingsStore from 'matrix-react-sdk/lib/settings/SettingsStore';
import TagOrderActions from 'matrix-react-sdk/lib/actions/TagOrderActions';
import RoomListActions from 'matrix-react-sdk/lib/actions/RoomListActions';


var LeftPanel = React.createClass({
    displayName: 'LeftPanel',

    // NB. If you add props, don't forget to update
    // shouldComponentUpdate!
    propTypes: {
        collapsed: PropTypes.bool.isRequired,
    },

    contextTypes: {
        matrixClient: PropTypes.instanceOf(MatrixClient),
    },

    getInitialState: function() {
        return {
            searchFilter: '',
        };
    },

    componentWillMount: function() {
        this.focusedElement = null;
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        // MatrixChat will update whenever the user switches
        // rooms, but propagating this change all the way down
        // the react tree is quite slow, so we cut this off
        // here. The RoomTiles listen for the room change
        // events themselves to know when to update.
        // We just need to update if any of these things change.
        if (
            this.props.collapsed !== nextProps.collapsed ||
            this.props.disabled !== nextProps.disabled
        ) {
            return true;
        }

        if (this.state.searchFilter !== nextState.searchFilter) {
            return true;
        }

        return false;
    },

    _onFocus: function(ev) {
        this.focusedElement = ev.target;
    },

    _onBlur: function(ev) {
        this.focusedElement = null;
    },

    _onKeyDown: function(ev) {
        if (!this.focusedElement) return;
        let handled = false;

        switch (ev.keyCode) {
            case KeyCode.UP:
                this._onMoveFocus(true);
                handled = true;
                break;
            case KeyCode.DOWN:
                this._onMoveFocus(false);
                handled = true;
                break;
        }

        if (handled) {
            ev.stopPropagation();
            ev.preventDefault();
        }
    },

    _onMoveFocus: function(up) {
        var element = this.focusedElement;

        // unclear why this isn't needed
        // var descending = (up == this.focusDirection) ? this.focusDescending : !this.focusDescending;
        // this.focusDirection = up;

        var descending = false; // are we currently descending or ascending through the DOM tree?
        var classes;

        do {
            var child = up ? element.lastElementChild : element.firstElementChild;
            var sibling = up ? element.previousElementSibling : element.nextElementSibling;

            if (descending) {
                if (child) {
                    element = child;
                }
                else if (sibling) {
                    element = sibling;
                }
                else {
                    descending = false;
                    element = element.parentElement;
                }
            }
            else {
                if (sibling) {
                    element = sibling;
                    descending = true;
                }
                else {
                    element = element.parentElement;
                }
            }

            if (element) {
                classes = element.classList;
                if (classes.contains("mx_LeftPanel")) { // we hit the top
                    element = up ? element.lastElementChild : element.firstElementChild;
                    descending = true;
                }
            }

        } while(element && !(
            classes.contains("mx_RoomTile") ||
            classes.contains("mx_SearchBox_search") ||
            classes.contains("mx_RoomSubList_ellipsis")));

        if (element) {
            element.focus();
            this.focusedElement = element;
            this.focusedDescending = descending;
        }
    },

    onHideClick: function() {
        dis.dispatch({
            action: 'hide_left_panel',
        });
    },

    onSearch: function(term) {
        this.setState({ searchFilter: term });
    },

    onDragEnd: function(result) {
        // Dragged to an invalid destination, not onto a droppable
        if (!result.destination) {
            return;
        }

        const dest = result.destination.droppableId;

        if (dest === 'tag-panel-droppable') {
            // Dispatch synchronously so that the TagPanel receives an
            // optimistic update from TagOrderStore before the previous
            // state is shown.
            dis.dispatch(TagOrderActions.moveTag(
                this.context.matrixClient,
                result.draggableId,
                result.destination.index,
            ), true);
        } else {
            this.onRoomTileEndDrag(result);
        }
    },

    onRoomTileEndDrag: function(result) {
        let newTag = result.destination.droppableId.split('_')[1];
        let prevTag = result.source.droppableId.split('_')[1];
        if (newTag === 'undefined') newTag = undefined;
        if (prevTag === 'undefined') prevTag = undefined;

        const roomId = result.draggableId.split('_')[1];

        const oldIndex = result.source.index;
        const newIndex = result.destination.index;

        dis.dispatch(RoomListActions.tagRoom(
            this.context.matrixClient,
            this.context.matrixClient.getRoom(roomId),
            prevTag, newTag,
            oldIndex, newIndex,
        ), true);
    },

    collectRoomList: function(ref) {
        this._roomList = ref;
    },

    render: function() {
        const RoomList = sdk.getComponent('rooms.RoomList');
        const TagPanel = sdk.getComponent('structures.TagPanel');
        const BottomLeftMenu = sdk.getComponent('structures.BottomLeftMenu');
        const CallPreview = sdk.getComponent('voip.CallPreview');

        let topBox;
        if (this.context.matrixClient.isGuest()) {
            const LoginBox = sdk.getComponent('structures.LoginBox');
            topBox = <LoginBox collapsed={ this.props.collapsed }/>;
        } else {
            const SearchBox = sdk.getComponent('structures.SearchBox');
            topBox = <SearchBox collapsed={ this.props.collapsed } onSearch={ this.onSearch } />;
        }

        let classes = classNames(
            "mx_LeftPanel", "mx_fadable",
            {
                "collapsed": this.props.collapsed,
                "mx_fadable_faded": this.props.disabled,
            }
        );

        const containerClasses = classNames(
            "mx_LeftPanel_container",
            { "mx_LeftPanel_container_collapsed": this.props.collapsed },
        );

        return (
            <DragDropContext onDragEnd={this.onDragEnd}>
                <div className={containerClasses}>
                    { SettingsStore.isFeatureEnabled("feature_tag_panel") ? <TagPanel /> : <div /> }
                    <aside className={classes} onKeyDown={ this._onKeyDown } onFocus={ this._onFocus } onBlur={ this._onBlur }>
                        { topBox }
                        <CallPreview ConferenceHandler={VectorConferenceHandler} />
                        <RoomList
                            ref={this.collectRoomList}
                            collapsed={this.props.collapsed}
                            searchFilter={this.state.searchFilter}
                            ConferenceHandler={VectorConferenceHandler} />
                        <BottomLeftMenu collapsed={this.props.collapsed}/>
                    </aside>
                </div>
            </DragDropContext>
        );
    }
});

module.exports = LeftPanel;
