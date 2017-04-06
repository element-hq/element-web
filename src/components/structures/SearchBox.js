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

var React = require('react');
var counterpart = require('counterpart');
var sdk = require('matrix-react-sdk')
var dis = require('matrix-react-sdk/lib/dispatcher');
var rate_limited_func = require('matrix-react-sdk/lib/ratelimitedfunc');
var AccessibleButton = require('matrix-react-sdk/lib/components/views/elements/AccessibleButton');

module.exports = React.createClass({
    displayName: 'SearchBox',

    propTypes: {
        collapsed: React.PropTypes.bool,
        onSearch: React.PropTypes.func,
    },

    getInitialState: function() {
        return {
            searchTerm: "",
        };
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    onAction: function(payload) {
        // Disabling this as I find it really really annoying, and was used to the
        // previous behaviour - see https://github.com/vector-im/riot-web/issues/3348
/*        
        switch (payload.action) {
            // Clear up the text field when a room is selected.
            case 'view_room':
                if (this.refs.search) {
                    this._clearSearch();
                }
                break;
        }
*/        
    },

    onChange: function() {
        if (!this.refs.search) return;
        this.setState({ searchTerm: this.refs.search.value });
        this.onSearch();
    },

    onSearch: new rate_limited_func(
        function() {
            this.props.onSearch(this.refs.search.value);
        },
        100
    ),

    onToggleCollapse: function(show) {
        if (show) {
            dis.dispatch({
                action: 'show_left_panel',
            });
        }
        else {
            dis.dispatch({
                action: 'hide_left_panel',
            });
        }
    },

    _clearSearch: function() {
        this.refs.search.value = "";
        this.onChange();
    },

    render: function() {
        var TintableSvg = sdk.getComponent('elements.TintableSvg');

        var collapseTabIndex = this.refs.search && this.refs.search.value !== "" ? "-1" : "0";

        var toggleCollapse;
        if (this.props.collapsed) {
            toggleCollapse =
                <AccessibleButton className="mx_SearchBox_maximise" tabIndex={collapseTabIndex} onClick={ this.onToggleCollapse.bind(this, true) }>
                    <TintableSvg src="img/maximise.svg" width="10" height="16" alt="Expand panel"/>
                </AccessibleButton>
        }
        else {
            toggleCollapse =
                <AccessibleButton className="mx_SearchBox_minimise" tabIndex={collapseTabIndex} onClick={ this.onToggleCollapse.bind(this, false) }>
                    <TintableSvg src="img/minimise.svg" width="10" height="16" alt="Collapse panel"/>
                </AccessibleButton>
        }

        var searchControls;
        if (!this.props.collapsed) {
            searchControls = [
                    this.state.searchTerm.length > 0 ?
                    <AccessibleButton key="button"
                            className="mx_SearchBox_closeButton"
                            onClick={ ()=>{ this._clearSearch(); } }>
                        <TintableSvg
                            className="mx_SearchBox_searchButton"
                            src="img/icons-close.svg" width="24" height="24"
                        />
                    </AccessibleButton>
                    :
                    <TintableSvg
                        key="button"
                        className="mx_SearchBox_searchButton"
                        src="img/icons-search-copy.svg" width="13" height="13"
                    />,
                    <input
                        key="searchfield"
                        type="text"
                        ref="search"
                        className="mx_SearchBox_search"
                        value={ this.state.searchTerm }
                        onChange={ this.onChange }
                        placeholder={ counterpart.translate('Filter room names') }
                    />
                ];
        }

        var self = this;
        return (
            <div className="mx_SearchBox">
                { searchControls }
                { toggleCollapse }
            </div>
        );
    }
});
