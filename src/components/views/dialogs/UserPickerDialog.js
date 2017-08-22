/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd

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
import { _t } from '../../../languageHandler';
import sdk from '../../../index';
import MatrixClientPeg from '../../../MatrixClientPeg';
import AccessibleButton from '../elements/AccessibleButton';
import Promise from 'bluebird';
import { addressTypes, getAddressType } from '../../../UserAddress.js';

const TRUNCATE_QUERY_LIST = 40;
const QUERY_USER_DIRECTORY_DEBOUNCE_MS = 200;

module.exports = React.createClass({
    displayName: "UserPickerDialog",

    propTypes: {
        title: PropTypes.string.isRequired,
        description: PropTypes.node,
        value: PropTypes.string,
        placeholder: PropTypes.string,
        roomId: PropTypes.string,
        button: PropTypes.string,
        focus: PropTypes.bool,
        validAddressTypes: PropTypes.arrayOf(PropTypes.oneOf(addressTypes)),
        onFinished: PropTypes.func.isRequired,
    },

    getDefaultProps: function() {
        return {
            value: "",
            focus: true,
            validAddressTypes: addressTypes,
        };
    },

    getInitialState: function() {
        return {
            error: false,

            // List of UserAddressType objects representing
            // the list of addresses we're going to invite
            userList: [],

            // Whether a search is ongoing
            busy: false,
            // An error message generated during the user directory search
            searchError: null,
            // Whether the server supports the user_directory API
            serverSupportsUserDirectory: true,
            // The query being searched for
            query: "",
            // List of UserAddressType objects representing
            // the set of auto-completion results for the current search
            // query.
            queryList: [],
        };
    },

    componentDidMount: function() {
        if (this.props.focus) {
            // Set the cursor at the end of the text input
            this.refs.textinput.value = this.props.value;
        }
    },

    onButtonClick: function() {
        let userList = this.state.userList.slice();
        // Check the text input field to see if user has an unconverted address
        // If there is and it's valid add it to the local userList
        if (this.refs.textinput.value !== '') {
            userList = this._addInputToList();
            if (userList === null) return;
        }
        this.props.onFinished(true, userList);
    },

    onCancel: function() {
        this.props.onFinished(false);
    },

    onKeyDown: function(e) {
        if (e.keyCode === 27) { // escape
            e.stopPropagation();
            e.preventDefault();
            this.props.onFinished(false);
        } else if (e.keyCode === 38) { // up arrow
            e.stopPropagation();
            e.preventDefault();
            if (this.addressSelector) this.addressSelector.moveSelectionUp();
        } else if (e.keyCode === 40) { // down arrow
            e.stopPropagation();
            e.preventDefault();
            if (this.addressSelector) this.addressSelector.moveSelectionDown();
        } else if (this.state.queryList.length > 0 && (e.keyCode === 188 || e.keyCode === 13 || e.keyCode === 9)) { // comma or enter or tab
            e.stopPropagation();
            e.preventDefault();
            if (this.addressSelector) this.addressSelector.chooseSelection();
        } else if (this.refs.textinput.value.length === 0 && this.state.userList.length && e.keyCode === 8) { // backspace
            e.stopPropagation();
            e.preventDefault();
            this.onDismissed(this.state.userList.length - 1)();
        } else if (e.keyCode === 13) { // enter
            e.stopPropagation();
            e.preventDefault();
            if (this.refs.textinput.value == '') {
                // if there's nothing in the input box, submit the form
                this.onButtonClick();
            } else {
                this._addInputToList();
            }
        } else if (e.keyCode === 188 || e.keyCode === 9) { // comma or tab
            e.stopPropagation();
            e.preventDefault();
            this._addInputToList();
        }
    },

    onQueryChanged: function(ev) {
        const query = ev.target.value;
        if (this.queryChangedDebouncer) {
            clearTimeout(this.queryChangedDebouncer);
        }
        // Only do search if there is something to search
        if (query.length > 0 && query != '@' && query.length >= 2) {
            this.queryChangedDebouncer = setTimeout(() => {
                if (this.state.serverSupportsUserDirectory) {
                    this._doUserDirectorySearch(query);
                } else {
                    this._doLocalSearch(query);
                }
            }, QUERY_USER_DIRECTORY_DEBOUNCE_MS);
        } else {
            this.setState({
                queryList: [],
                query: "",
                searchError: null,
            });
        }
    },

    onDismissed: function(index) {
        return () => {
            const userList = this.state.userList.slice();
            userList.splice(index, 1);
            this.setState({
                userList: userList,
                queryList: [],
                query: "",
            });
            if (this._cancelThreepidLookup) this._cancelThreepidLookup();
        };
    },

    onClick: function(index) {
        return () => {
            this.onSelected(index);
        };
    },

    onSelected: function(index) {
        const userList = this.state.userList.slice();
        userList.push(this.state.queryList[index]);
        this.setState({
            userList: userList,
            queryList: [],
            query: "",
        });
        if (this._cancelThreepidLookup) this._cancelThreepidLookup();
    },

    _doUserDirectorySearch: function(query) {
        this.setState({
            busy: true,
            query,
            searchError: null,
        });
        MatrixClientPeg.get().searchUserDirectory({
            term: query,
        }).then((resp) => {
            // The query might have changed since we sent the request, so ignore
            // responses for anything other than the latest query.
            if (this.state.query !== query) {
                return;
            }
            this._processResults(resp.results, query);
        }).catch((err) => {
            console.error('Error whilst searching user directory: ', err);
            this.setState({
                searchError: err.errcode ? err.message : _t('Something went wrong!'),
            });
            if (err.errcode === 'M_UNRECOGNIZED') {
                this.setState({
                    serverSupportsUserDirectory: false,
                });
                // Do a local search immediately
                this._doLocalSearch(query);
            }
        }).done(() => {
            this.setState({
                busy: false,
            });
        });
    },

    _doLocalSearch: function(query) {
        this.setState({
            query,
            searchError: null,
        });
        const queryLowercase = query.toLowerCase();
        const results = [];
        MatrixClientPeg.get().getUsers().forEach((user) => {
            if (user.userId.toLowerCase().indexOf(queryLowercase) === -1 &&
                user.displayName.toLowerCase().indexOf(queryLowercase) === -1
            ) {
                return;
            }

            // Put results in the format of the new API
            results.push({
                user_id: user.userId,
                display_name: user.displayName,
                avatar_url: user.avatarUrl,
            });
        });
        this._processResults(results, query);
    },

    _processResults: function(results, query) {
        const queryList = [];
        results.forEach((user) => {
            if (user.user_id === MatrixClientPeg.get().credentials.userId) {
                return;
            }
            // Return objects, structure of which is defined
            // by UserAddressType
            queryList.push({
                addressType: 'mx',
                address: user.user_id,
                displayName: user.display_name,
                avatarMxc: user.avatar_url,
                isKnown: true,
            });
        });

        // If the query is a valid address, add an entry for that
        // This is important, otherwise there's no way to invite
        // a perfectly valid address if there are close matches.
        const addrType = getAddressType(query);
        if (this.props.validAddressTypes.includes(addrType)) {
            queryList.unshift({
                addressType: addrType,
                address: query,
                isKnown: false,
            });
            if (this._cancelThreepidLookup) this._cancelThreepidLookup();
            if (addrType == 'email') {
                this._lookupThreepid(addrType, query).done();
            }
        }
        this.setState({
            queryList,
            error: false,
        }, () => {
            if (this.addressSelector) this.addressSelector.moveSelectionTop();
        });
    },

    _addInputToList: function() {
        const addressText = this.refs.textinput.value.trim();
        const addrType = getAddressType(addressText);
        const addrObj = {
            addressType: addrType,
            address: addressText,
            isKnown: false,
        };
        if (addrType == null) {
            this.setState({ error: true });
            return null;
        } else if (addrType == 'mx') {
            const user = MatrixClientPeg.get().getUser(addrObj.address);
            if (user) {
                addrObj.displayName = user.displayName;
                addrObj.avatarMxc = user.avatarUrl;
                addrObj.isKnown = true;
            }
        }

        const userList = this.state.userList.slice();
        userList.push(addrObj);
        this.setState({
            userList: userList,
            queryList: [],
            query: "",
        });
        if (this._cancelThreepidLookup) this._cancelThreepidLookup();
        return userList;
    },

    _lookupThreepid: function(medium, address) {
        let cancelled = false;
        // Note that we can't safely remove this after we're done
        // because we don't know that it's the same one, so we just
        // leave it: it's replacing the old one each time so it's
        // not like they leak.
        this._cancelThreepidLookup = function() {
            cancelled = true;
        };

        // wait a bit to let the user finish typing
        return Promise.delay(500).then(() => {
            if (cancelled) return null;
            return MatrixClientPeg.get().lookupThreePid(medium, address);
        }).then((res) => {
            if (res === null || !res.mxid) return null;
            if (cancelled) return null;

            return MatrixClientPeg.get().getProfileInfo(res.mxid);
        }).then((res) => {
            if (res === null) return null;
            if (cancelled) return null;
            this.setState({
                queryList: [{
                    // a UserAddressType
                    addressType: medium,
                    address: address,
                    displayName: res.displayname,
                    avatarMxc: res.avatar_url,
                    isKnown: true,
                }],
            });
        });
    },

    render: function() {
        const TintableSvg = sdk.getComponent("elements.TintableSvg");
        const AddressSelector = sdk.getComponent("elements.AddressSelector");
        this.scrollElement = null;

        const query = [];
        // create the invite list
        if (this.state.userList.length > 0) {
            const AddressTile = sdk.getComponent("elements.AddressTile");
            for (let i = 0; i < this.state.userList.length; i++) {
                query.push(
                    <AddressTile key={i} address={this.state.userList[i]} canDismiss={true} onDismissed={ this.onDismissed(i) } />,
                );
            }
        }

        // Add the query at the end
        query.push(
            <textarea key={this.state.userList.length}
                rows="1"
                id="textinput"
                ref="textinput"
                className="mx_ChatInviteDialog_input"
                onChange={this.onQueryChanged}
                placeholder={this.props.placeholder}
                defaultValue={this.props.value}
                autoFocus={this.props.focus}>
            </textarea>,
        );

        let error;
        let addressSelector;
        if (this.state.error) {
            error = <div className="mx_ChatInviteDialog_error">
                {_t("You have entered an invalid contact. Try using their Matrix ID or email address.")}
            </div>;
        } else if (this.state.searchError) {
            error = <div className="mx_ChatInviteDialog_error">{this.state.searchError}</div>;
        } else if (
            this.state.query.length > 0 &&
            this.state.queryList.length === 0 &&
            !this.state.busy
        ) {
            error = <div className="mx_ChatInviteDialog_error">{_t("No results")}</div>;
        } else {
            addressSelector = (
                <AddressSelector ref={(ref) => {this.addressSelector = ref;}}
                    addressList={ this.state.queryList }
                    onSelected={ this.onSelected }
                    truncateAt={ TRUNCATE_QUERY_LIST }
                />
            );
        }

        return (
            <div className="mx_ChatInviteDialog" onKeyDown={this.onKeyDown}>
                <div className="mx_Dialog_title">
                    {this.props.title}
                </div>
                <AccessibleButton className="mx_ChatInviteDialog_cancel"
                        onClick={this.onCancel} >
                    <TintableSvg src="img/icons-close-button.svg" width="35" height="35" />
                </AccessibleButton>
                <div className="mx_ChatInviteDialog_label">
                    <label htmlFor="textinput">{ this.props.description }</label>
                </div>
                <div className="mx_Dialog_content">
                    <div className="mx_ChatInviteDialog_inputContainer">{ query }</div>
                    { error }
                    { addressSelector }
                </div>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" onClick={this.onButtonClick}>
                        {this.props.button}
                    </button>
                </div>
            </div>
        );
    },
});
