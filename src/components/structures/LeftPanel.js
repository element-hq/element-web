/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Key } from '../../Keyboard';
import * as sdk from '../../index';
import dis from '../../dispatcher/dispatcher';
import * as VectorConferenceHandler from '../../VectorConferenceHandler';
import SettingsStore from '../../settings/SettingsStore';
import {_t} from "../../languageHandler";
import Analytics from "../../Analytics";
import {Action} from "../../dispatcher/actions";


const LeftPanel = createReactClass({
    displayName: 'LeftPanel',

    // NB. If you add props, don't forget to update
    // shouldComponentUpdate!
    propTypes: {
        collapsed: PropTypes.bool.isRequired,
    },

    getInitialState: function() {
        return {
            searchFilter: '',
            breadcrumbs: false,
        };
    },

    // TODO: [REACT-WARNING] Move this to constructor
    UNSAFE_componentWillMount: function() {
        this.focusedElement = null;

        this._breadcrumbsWatcherRef = SettingsStore.watchSetting(
            "breadcrumbs", null, this._onBreadcrumbsChanged);
        this._tagPanelWatcherRef = SettingsStore.watchSetting(
            "TagPanel.enableTagPanel", null, () => this.forceUpdate());

        const useBreadcrumbs = !!SettingsStore.getValue("breadcrumbs");
        Analytics.setBreadcrumbs(useBreadcrumbs);
        this.setState({breadcrumbs: useBreadcrumbs});
    },

    componentWillUnmount: function() {
        SettingsStore.unwatchSetting(this._breadcrumbsWatcherRef);
        SettingsStore.unwatchSetting(this._tagPanelWatcherRef);
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
        if (this.state.searchExpanded !== nextState.searchExpanded) {
            return true;
        }

        return false;
    },

    componentDidUpdate(prevProps, prevState) {
        if (prevState.breadcrumbs !== this.state.breadcrumbs) {
            Analytics.setBreadcrumbs(this.state.breadcrumbs);
        }
    },

    _onBreadcrumbsChanged: function(settingName, roomId, level, valueAtLevel, value) {
        // Features are only possible at a single level, so we can get away with using valueAtLevel.
        // The SettingsStore runs on the same tick as the update, so `value` will be wrong.
        this.setState({breadcrumbs: valueAtLevel});

        // For some reason the setState doesn't trigger a render of the component, so force one.
        // Probably has to do with the change happening outside of a change detector cycle.
        this.forceUpdate();
    },

    _onFocus: function(ev) {
        this.focusedElement = ev.target;
    },

    _onBlur: function(ev) {
        this.focusedElement = null;
    },

    _onFilterKeyDown: function(ev) {
        if (!this.focusedElement) return;

        switch (ev.key) {
            // On enter of rooms filter select and activate first room if such one exists
            case Key.ENTER: {
                const firstRoom = ev.target.closest(".mx_LeftPanel").querySelector(".mx_RoomTile");
                if (firstRoom) {
                    firstRoom.click();
                }
                break;
            }
        }
    },

    _onKeyDown: function(ev) {
        if (!this.focusedElement) return;

        switch (ev.key) {
            case Key.ARROW_UP:
                this._onMoveFocus(ev, true, true);
                break;
            case Key.ARROW_DOWN:
                this._onMoveFocus(ev, false, true);
                break;
        }
    },

    _onMoveFocus: function(ev, up, trap) {
        let element = this.focusedElement;

        // unclear why this isn't needed
        // var descending = (up == this.focusDirection) ? this.focusDescending : !this.focusDescending;
        // this.focusDirection = up;

        let descending = false; // are we currently descending or ascending through the DOM tree?
        let classes;

        do {
            const child = up ? element.lastElementChild : element.firstElementChild;
            const sibling = up ? element.previousElementSibling : element.nextElementSibling;

            if (descending) {
                if (child) {
                    element = child;
                } else if (sibling) {
                    element = sibling;
                } else {
                    descending = false;
                    element = element.parentElement;
                }
            } else {
                if (sibling) {
                    element = sibling;
                    descending = true;
                } else {
                    element = element.parentElement;
                }
            }

            if (element) {
                classes = element.classList;
            }
        } while (element && !(
            classes.contains("mx_RoomTile") ||
            classes.contains("mx_RoomSubList_label") ||
            classes.contains("mx_LeftPanel_filterRooms")));

        if (element) {
            ev.stopPropagation();
            ev.preventDefault();
            element.focus();
            this.focusedElement = element;
        } else if (trap) {
            // if navigation is via up/down arrow-keys, trap in the widget so it doesn't send to composer
            ev.stopPropagation();
            ev.preventDefault();
        }
    },

    onSearch: function(term) {
        this.setState({ searchFilter: term });
    },

    onSearchCleared: function(source) {
        if (source === "keyboard") {
            dis.fire(Action.FocusComposer);
        }
        this.setState({searchExpanded: false});
    },

    collectRoomList: function(ref) {
        this._roomList = ref;
    },

    _onSearchFocus: function() {
        this.setState({searchExpanded: true});
    },

    _onSearchBlur: function(event) {
        if (event.target.value.length === 0) {
            this.setState({searchExpanded: false});
        }
    },

    render: function() {
        const RoomList = sdk.getComponent('rooms.RoomList');
        const RoomBreadcrumbs = sdk.getComponent('rooms.RoomBreadcrumbs');
        const TagPanel = sdk.getComponent('structures.TagPanel');
        const CustomRoomTagPanel = sdk.getComponent('structures.CustomRoomTagPanel');
        const TopLeftMenuButton = sdk.getComponent('structures.TopLeftMenuButton');
        const SearchBox = sdk.getComponent('structures.SearchBox');
        const CallPreview = sdk.getComponent('voip.CallPreview');
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        const tagPanelEnabled = SettingsStore.getValue("TagPanel.enableTagPanel");
        let tagPanelContainer;

        const isCustomTagsEnabled = SettingsStore.isFeatureEnabled("feature_custom_tags");

        if (tagPanelEnabled) {
            tagPanelContainer = (<div className="mx_LeftPanel_tagPanelContainer">
                <TagPanel />
                { isCustomTagsEnabled ? <CustomRoomTagPanel /> : undefined }
            </div>);
        }

        const containerClasses = classNames(
            "mx_LeftPanel_container", "mx_fadable",
            {
                "collapsed": this.props.collapsed,
                "mx_LeftPanel_container_hasTagPanel": tagPanelEnabled,
                "mx_fadable_faded": this.props.disabled,
            },
        );

        let exploreButton;
        if (!this.props.collapsed) {
            exploreButton = (
                <div className={classNames("mx_LeftPanel_explore", {"mx_LeftPanel_explore_hidden": this.state.searchExpanded})}>
                    <AccessibleButton onClick={() => dis.fire(Action.ViewRoomDirectory)}>{_t("Explore")}</AccessibleButton>
                </div>
            );
        }

        const searchBox = (<SearchBox
            className="mx_LeftPanel_filterRooms"
            enableRoomSearchFocus={true}
            blurredPlaceholder={ _t('Filter') }
            placeholder={ _t('Filter rooms…') }
            onKeyDown={this._onFilterKeyDown}
            onSearch={ this.onSearch }
            onCleared={ this.onSearchCleared }
            onFocus={this._onSearchFocus}
            onBlur={this._onSearchBlur}
            collapsed={this.props.collapsed} />);

        let breadcrumbs;
        if (this.state.breadcrumbs) {
            breadcrumbs = (<RoomBreadcrumbs collapsed={this.props.collapsed} />);
        }

        const roomList = <RoomList
            onKeyDown={this._onKeyDown}
            onFocus={this._onFocus}
            onBlur={this._onBlur}
            ref={this.collectRoomList}
            resizeNotifier={this.props.resizeNotifier}
            collapsed={this.props.collapsed}
            searchFilter={this.state.searchFilter}
            ConferenceHandler={VectorConferenceHandler} />;

        return (
            <div className={containerClasses}>
                { tagPanelContainer }
                <aside className="mx_LeftPanel dark-panel">
                    <TopLeftMenuButton collapsed={this.props.collapsed} />
                    { breadcrumbs }
                    <CallPreview ConferenceHandler={VectorConferenceHandler} />
                    <div className="mx_LeftPanel_exploreAndFilterRow" onKeyDown={this._onKeyDown} onFocus={this._onFocus} onBlur={this._onBlur}>
                        { exploreButton }
                        { searchBox }
                    </div>
                    {roomList}
                </aside>
            </div>
        );
    },
});

export default LeftPanel;
