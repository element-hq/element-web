/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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
import { KeyCode } from '../../Keyboard';
import dis from '../../dispatcher';
import { throttle } from 'lodash';
import AccessibleButton from '../../components/views/elements/AccessibleButton';
import classNames from 'classnames';

module.exports = createReactClass({
    displayName: 'SearchBox',

    propTypes: {
        onSearch: PropTypes.func,
        onCleared: PropTypes.func,
        className: PropTypes.string,
        placeholder: PropTypes.string.isRequired,

        // If true, the search box will focus and clear itself
        // on room search focus action (it would be nicer to take
        // this functionality out, but not obvious how that would work)
        enableRoomSearchFocus: PropTypes.bool,
    },

    getDefaultProps: function() {
        return {
            enableRoomSearchFocus: false,
        };
    },

    getInitialState: function() {
        return {
            searchTerm: "",
            blurred: true,
        };
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    onAction: function(payload) {
        if (!this.props.enableRoomSearchFocus) return;

        switch (payload.action) {
            case 'view_room':
                if (this.refs.search && payload.clear_search) {
                    this._clearSearch();
                }
                break;
            case 'focus_room_filter':
                if (this.refs.search) {
                    this.refs.search.focus();
                }
                break;
        }
    },

    onChange: function() {
        if (!this.refs.search) return;
        this.setState({ searchTerm: this.refs.search.value });
        this.onSearch();
    },

    onSearch: throttle(function() {
        this.props.onSearch(this.refs.search.value);
    }, 200, {trailing: true, leading: true}),

    _onKeyDown: function(ev) {
        switch (ev.keyCode) {
            case KeyCode.ESCAPE:
                this._clearSearch("keyboard");
                break;
        }
    },

    _onFocus: function(ev) {
        this.setState({blurred: false});
        ev.target.select();
        if (this.props.onFocus) {
            this.props.onFocus(ev);
        }
    },

    _onBlur: function(ev) {
        this.setState({blurred: true});
        if (this.props.onBlur) {
            this.props.onBlur(ev);
        }
    },

    _clearSearch: function(source) {
        this.refs.search.value = "";
        this.onChange();
        if (this.props.onCleared) {
            this.props.onCleared(source);
        }
    },

    render: function() {
        // check for collapsed here and
        // not at parent so we keep
        // searchTerm in our state
        // when collapsing and expanding
        if (this.props.collapsed) {
            return null;
        }
        const clearButton = (!this.state.blurred || this.state.searchTerm) ?
            (<AccessibleButton key="button"
                    className="mx_SearchBox_closeButton"
                    onClick={ () => {this._clearSearch("button"); } }>
            </AccessibleButton>) : undefined;

        // show a shorter placeholder when blurred, if requested
        // this is used for the room filter field that has
        // the explore button next to it when blurred
        const placeholder = this.state.blurred ?
            (this.props.blurredPlaceholder || this.props.placeholder) :
            this.props.placeholder;
        const className = this.props.className || "";
        return (
            <div className={classNames("mx_SearchBox", "mx_textinput", {"mx_SearchBox_blurred": this.state.blurred})}>
                <input
                    key="searchfield"
                    type="text"
                    ref="search"
                    className={"mx_textinput_icon mx_textinput_search " + className}
                    value={ this.state.searchTerm }
                    onFocus={ this._onFocus }
                    onChange={ this.onChange }
                    onKeyDown={ this._onKeyDown }
                    onBlur={this._onBlur}
                    placeholder={ placeholder }
                />
                { clearButton }
            </div>
        );
    },
});
