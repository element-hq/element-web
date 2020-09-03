/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018, 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
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

import React, {createRef} from 'react';
import PropTypes from 'prop-types';

import { _t, _td } from '../../../languageHandler';
import * as sdk from '../../../index';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import dis from '../../../dispatcher/dispatcher';
import { addressTypes, getAddressType } from '../../../UserAddress.js';
import GroupStore from '../../../stores/GroupStore';
import * as Email from '../../../email';
import IdentityAuthClient from '../../../IdentityAuthClient';
import { getDefaultIdentityServerUrl, useDefaultIdentityServer } from '../../../utils/IdentityServerUtils';
import { abbreviateUrl } from '../../../utils/UrlUtils';
import {sleep} from "../../../utils/promise";
import {Key} from "../../../Keyboard";
import {Action} from "../../../dispatcher/actions";

const TRUNCATE_QUERY_LIST = 40;
const QUERY_USER_DIRECTORY_DEBOUNCE_MS = 200;

const addressTypeName = {
    'mx-user-id': _td("Matrix ID"),
    'mx-room-id': _td("Matrix Room ID"),
    'email': _td("email address"),
};


export default class AddressPickerDialog extends React.Component {
    static propTypes = {
        title: PropTypes.string.isRequired,
        description: PropTypes.node,
        // Extra node inserted after picker input, dropdown and errors
        extraNode: PropTypes.node,
        value: PropTypes.string,
        placeholder: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
        roomId: PropTypes.string,
        button: PropTypes.string,
        focus: PropTypes.bool,
        validAddressTypes: PropTypes.arrayOf(PropTypes.oneOf(addressTypes)),
        onFinished: PropTypes.func.isRequired,
        groupId: PropTypes.string,
        // The type of entity to search for. Default: 'user'.
        pickerType: PropTypes.oneOf(['user', 'room']),
        // Whether the current user should be included in the addresses returned. Only
        // applicable when pickerType is `user`. Default: false.
        includeSelf: PropTypes.bool,
    };

    static defaultProps = {
        value: "",
        focus: true,
        validAddressTypes: addressTypes,
        pickerType: 'user',
        includeSelf: false,
    };

    constructor(props) {
        super(props);

        this._textinput = createRef();

        let validAddressTypes = this.props.validAddressTypes;
        // Remove email from validAddressTypes if no IS is configured. It may be added at a later stage by the user
        if (!MatrixClientPeg.get().getIdentityServerUrl() && validAddressTypes.includes("email")) {
            validAddressTypes = validAddressTypes.filter(type => type !== "email");
        }

        this.state = {
            // Whether to show an error message because of an invalid address
            invalidAddressError: false,
            // List of UserAddressType objects representing
            // the list of addresses we're going to invite
            selectedList: [],
            // Whether a search is ongoing
            busy: false,
            // An error message generated during the user directory search
            searchError: null,
            // Whether the server supports the user_directory API
            serverSupportsUserDirectory: true,
            // The query being searched for
            query: "",
            // List of UserAddressType objects representing the set of
            // auto-completion results for the current search query.
            suggestedList: [],
            // List of address types initialised from props, but may change while the
            // dialog is open and represents the supported list of address types at this time.
            validAddressTypes,
        };
    }

    componentDidMount() {
        if (this.props.focus) {
            // Set the cursor at the end of the text input
            this._textinput.current.value = this.props.value;
        }
    }

    getPlaceholder() {
        const { placeholder } = this.props;
        if (typeof placeholder === "string") {
            return placeholder;
        }
        // Otherwise it's a function, as checked by prop types.
        return placeholder(this.state.validAddressTypes);
    }

    onButtonClick = () => {
        let selectedList = this.state.selectedList.slice();
        // Check the text input field to see if user has an unconverted address
        // If there is and it's valid add it to the local selectedList
        if (this._textinput.current.value !== '') {
            selectedList = this._addAddressesToList([this._textinput.current.value]);
            if (selectedList === null) return;
        }
        this.props.onFinished(true, selectedList);
    };

    onCancel = () => {
        this.props.onFinished(false);
    };

    onKeyDown = e => {
        const textInput = this._textinput.current ? this._textinput.current.value : undefined;

        if (e.key === Key.ESCAPE) {
            e.stopPropagation();
            e.preventDefault();
            this.props.onFinished(false);
        } else if (e.key === Key.ARROW_UP) {
            e.stopPropagation();
            e.preventDefault();
            if (this.addressSelector) this.addressSelector.moveSelectionUp();
        } else if (e.key === Key.ARROW_DOWN) {
            e.stopPropagation();
            e.preventDefault();
            if (this.addressSelector) this.addressSelector.moveSelectionDown();
        } else if (this.state.suggestedList.length > 0 && [Key.COMMA, Key.ENTER, Key.TAB].includes(e.key)) {
            e.stopPropagation();
            e.preventDefault();
            if (this.addressSelector) this.addressSelector.chooseSelection();
        } else if (textInput.length === 0 && this.state.selectedList.length && e.key === Key.BACKSPACE) {
            e.stopPropagation();
            e.preventDefault();
            this.onDismissed(this.state.selectedList.length - 1)();
        } else if (e.key === Key.ENTER) {
            e.stopPropagation();
            e.preventDefault();
            if (textInput === '') {
                // if there's nothing in the input box, submit the form
                this.onButtonClick();
            } else {
                this._addAddressesToList([textInput]);
            }
        } else if (textInput && (e.key === Key.COMMA || e.key === Key.TAB)) {
            e.stopPropagation();
            e.preventDefault();
            this._addAddressesToList([textInput]);
        }
    };

    onQueryChanged = ev => {
        const query = ev.target.value;
        if (this.queryChangedDebouncer) {
            clearTimeout(this.queryChangedDebouncer);
        }
        // Only do search if there is something to search
        if (query.length > 0 && query !== '@' && query.length >= 2) {
            this.queryChangedDebouncer = setTimeout(() => {
                if (this.props.pickerType === 'user') {
                    if (this.props.groupId) {
                        this._doNaiveGroupSearch(query);
                    } else if (this.state.serverSupportsUserDirectory) {
                        this._doUserDirectorySearch(query);
                    } else {
                        this._doLocalSearch(query);
                    }
                } else if (this.props.pickerType === 'room') {
                    if (this.props.groupId) {
                        this._doNaiveGroupRoomSearch(query);
                    } else {
                        this._doRoomSearch(query);
                    }
                } else {
                    console.error('Unknown pickerType', this.props.pickerType);
                }
            }, QUERY_USER_DIRECTORY_DEBOUNCE_MS);
        } else {
            this.setState({
                suggestedList: [],
                query: "",
                searchError: null,
            });
        }
    };

    onDismissed = index => () => {
        const selectedList = this.state.selectedList.slice();
        selectedList.splice(index, 1);
        this.setState({
            selectedList,
            suggestedList: [],
            query: "",
        });
        if (this._cancelThreepidLookup) this._cancelThreepidLookup();
    };

    onClick = index => () => {
        this.onSelected(index);
    };

    onSelected = index => {
        const selectedList = this.state.selectedList.slice();
        selectedList.push(this._getFilteredSuggestions()[index]);
        this.setState({
            selectedList,
            suggestedList: [],
            query: "",
        });
        if (this._cancelThreepidLookup) this._cancelThreepidLookup();
    };

    _doNaiveGroupSearch(query) {
        const lowerCaseQuery = query.toLowerCase();
        this.setState({
            busy: true,
            query,
            searchError: null,
        });
        MatrixClientPeg.get().getGroupUsers(this.props.groupId).then((resp) => {
            const results = [];
            resp.chunk.forEach((u) => {
                const userIdMatch = u.user_id.toLowerCase().includes(lowerCaseQuery);
                const displayNameMatch = (u.displayname || '').toLowerCase().includes(lowerCaseQuery);
                if (!(userIdMatch || displayNameMatch)) {
                    return;
                }
                results.push({
                    user_id: u.user_id,
                    avatar_url: u.avatar_url,
                    display_name: u.displayname,
                });
            });
            this._processResults(results, query);
        }).catch((err) => {
            console.error('Error whilst searching group rooms: ', err);
            this.setState({
                searchError: err.errcode ? err.message : _t('Something went wrong!'),
            });
        }).then(() => {
            this.setState({
                busy: false,
            });
        });
    }

    _doNaiveGroupRoomSearch(query) {
        const lowerCaseQuery = query.toLowerCase();
        const results = [];
        GroupStore.getGroupRooms(this.props.groupId).forEach((r) => {
            const nameMatch = (r.name || '').toLowerCase().includes(lowerCaseQuery);
            const topicMatch = (r.topic || '').toLowerCase().includes(lowerCaseQuery);
            const aliasMatch = (r.canonical_alias || '').toLowerCase().includes(lowerCaseQuery);
            if (!(nameMatch || topicMatch || aliasMatch)) {
                return;
            }
            results.push({
                room_id: r.room_id,
                avatar_url: r.avatar_url,
                name: r.name || r.canonical_alias,
            });
        });
        this._processResults(results, query);
        this.setState({
            busy: false,
        });
    }

    _doRoomSearch(query) {
        const lowerCaseQuery = query.toLowerCase();
        const rooms = MatrixClientPeg.get().getRooms();
        const results = [];
        rooms.forEach((room) => {
            let rank = Infinity;
            const nameEvent = room.currentState.getStateEvents('m.room.name', '');
            const name = nameEvent ? nameEvent.getContent().name : '';
            const canonicalAlias = room.getCanonicalAlias();
            const aliasEvents = room.currentState.getStateEvents('m.room.aliases');
            const aliases = aliasEvents.map((ev) => ev.getContent().aliases).reduce((a, b) => {
                return a.concat(b);
            }, []);

            const nameMatch = (name || '').toLowerCase().includes(lowerCaseQuery);
            let aliasMatch = false;
            let shortestMatchingAliasLength = Infinity;
            aliases.forEach((alias) => {
                if ((alias || '').toLowerCase().includes(lowerCaseQuery)) {
                    aliasMatch = true;
                    if (shortestMatchingAliasLength > alias.length) {
                        shortestMatchingAliasLength = alias.length;
                    }
                }
            });

            if (!(nameMatch || aliasMatch)) {
                return;
            }

            if (aliasMatch) {
                // A shorter matching alias will give a better rank
                rank = shortestMatchingAliasLength;
            }

            const avatarEvent = room.currentState.getStateEvents('m.room.avatar', '');
            const avatarUrl = avatarEvent ? avatarEvent.getContent().url : undefined;

            results.push({
                rank,
                room_id: room.roomId,
                avatar_url: avatarUrl,
                name: name || canonicalAlias || aliases[0] || _t('Unnamed Room'),
            });
        });

        // Sort by rank ascending (a high rank being less relevant)
        const sortedResults = results.sort((a, b) => {
            return a.rank - b.rank;
        });

        this._processResults(sortedResults, query);
        this.setState({
            busy: false,
        });
    }

    _doUserDirectorySearch(query) {
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
        }).then(() => {
            this.setState({
                busy: false,
            });
        });
    }

    _doLocalSearch(query) {
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
    }

    _processResults(results, query) {
        const suggestedList = [];
        results.forEach((result) => {
            if (result.room_id) {
                const client = MatrixClientPeg.get();
                const room = client.getRoom(result.room_id);
                if (room) {
                    const tombstone = room.currentState.getStateEvents('m.room.tombstone', '');
                    if (tombstone && tombstone.getContent() && tombstone.getContent()["replacement_room"]) {
                        const replacementRoom = client.getRoom(tombstone.getContent()["replacement_room"]);

                        // Skip rooms with tombstones where we are also aware of the replacement room.
                        if (replacementRoom) return;
                    }
                }
                suggestedList.push({
                    addressType: 'mx-room-id',
                    address: result.room_id,
                    displayName: result.name,
                    avatarMxc: result.avatar_url,
                    isKnown: true,
                });
                return;
            }
            if (!this.props.includeSelf &&
                result.user_id === MatrixClientPeg.get().credentials.userId
            ) {
                return;
            }

            // Return objects, structure of which is defined
            // by UserAddressType
            suggestedList.push({
                addressType: 'mx-user-id',
                address: result.user_id,
                displayName: result.display_name,
                avatarMxc: result.avatar_url,
                isKnown: true,
            });
        });

        // If the query is a valid address, add an entry for that
        // This is important, otherwise there's no way to invite
        // a perfectly valid address if there are close matches.
        const addrType = getAddressType(query);
        if (this.state.validAddressTypes.includes(addrType)) {
            if (addrType === 'email' && !Email.looksValid(query)) {
                this.setState({searchError: _t("That doesn't look like a valid email address")});
                return;
            }
            suggestedList.unshift({
                addressType: addrType,
                address: query,
                isKnown: false,
            });
            if (this._cancelThreepidLookup) this._cancelThreepidLookup();
            if (addrType === 'email') {
                this._lookupThreepid(addrType, query);
            }
        }
        this.setState({
            suggestedList,
            invalidAddressError: false,
        }, () => {
            if (this.addressSelector) this.addressSelector.moveSelectionTop();
        });
    }

    _addAddressesToList(addressTexts) {
        const selectedList = this.state.selectedList.slice();

        let hasError = false;
        addressTexts.forEach((addressText) => {
            addressText = addressText.trim();
            const addrType = getAddressType(addressText);
            const addrObj = {
                addressType: addrType,
                address: addressText,
                isKnown: false,
            };

            if (!this.state.validAddressTypes.includes(addrType)) {
                hasError = true;
            } else if (addrType === 'mx-user-id') {
                const user = MatrixClientPeg.get().getUser(addrObj.address);
                if (user) {
                    addrObj.displayName = user.displayName;
                    addrObj.avatarMxc = user.avatarUrl;
                    addrObj.isKnown = true;
                }
            } else if (addrType === 'mx-room-id') {
                const room = MatrixClientPeg.get().getRoom(addrObj.address);
                if (room) {
                    addrObj.displayName = room.name;
                    addrObj.avatarMxc = room.avatarUrl;
                    addrObj.isKnown = true;
                }
            }

            selectedList.push(addrObj);
        });

        this.setState({
            selectedList,
            suggestedList: [],
            query: "",
            invalidAddressError: hasError ? true : this.state.invalidAddressError,
        });
        if (this._cancelThreepidLookup) this._cancelThreepidLookup();
        return hasError ? null : selectedList;
    }

    async _lookupThreepid(medium, address) {
        let cancelled = false;
        // Note that we can't safely remove this after we're done
        // because we don't know that it's the same one, so we just
        // leave it: it's replacing the old one each time so it's
        // not like they leak.
        this._cancelThreepidLookup = function() {
            cancelled = true;
        };

        // wait a bit to let the user finish typing
        await sleep(500);
        if (cancelled) return null;

        try {
            const authClient = new IdentityAuthClient();
            const identityAccessToken = await authClient.getAccessToken();
            if (cancelled) return null;

            const lookup = await MatrixClientPeg.get().lookupThreePid(
                medium,
                address,
                undefined /* callback */,
                identityAccessToken,
            );
            if (cancelled || lookup === null || !lookup.mxid) return null;

            const profile = await MatrixClientPeg.get().getProfileInfo(lookup.mxid);
            if (cancelled || profile === null) return null;

            this.setState({
                suggestedList: [{
                    // a UserAddressType
                    addressType: medium,
                    address: address,
                    displayName: profile.displayname,
                    avatarMxc: profile.avatar_url,
                    isKnown: true,
                }],
            });
        } catch (e) {
            console.error(e);
            this.setState({
                searchError: _t('Something went wrong!'),
            });
        }
    }

    _getFilteredSuggestions() {
        // map addressType => set of addresses to avoid O(n*m) operation
        const selectedAddresses = {};
        this.state.selectedList.forEach(({address, addressType}) => {
            if (!selectedAddresses[addressType]) selectedAddresses[addressType] = new Set();
            selectedAddresses[addressType].add(address);
        });

        // Filter out any addresses in the above already selected addresses (matching both type and address)
        return this.state.suggestedList.filter(({address, addressType}) => {
            return !(selectedAddresses[addressType] && selectedAddresses[addressType].has(address));
        });
    }

    _onPaste = e => {
        // Prevent the text being pasted into the textarea
        e.preventDefault();
        const text = e.clipboardData.getData("text");
        // Process it as a list of addresses to add instead
        this._addAddressesToList(text.split(/[\s,]+/));
    };

    onUseDefaultIdentityServerClick = e => {
        e.preventDefault();

        // Update the IS in account data. Actually using it may trigger terms.
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useDefaultIdentityServer();

        // Add email as a valid address type.
        const { validAddressTypes } = this.state;
        validAddressTypes.push('email');
        this.setState({ validAddressTypes });
    };

    onManageSettingsClick = e => {
        e.preventDefault();
        dis.fire(Action.ViewUserSettings);
        this.onCancel();
    };

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        const AddressSelector = sdk.getComponent("elements.AddressSelector");
        this.scrollElement = null;

        let inputLabel;
        if (this.props.description) {
            inputLabel = <div className="mx_AddressPickerDialog_label">
                <label htmlFor="textinput">{this.props.description}</label>
            </div>;
        }

        const query = [];
        // create the invite list
        if (this.state.selectedList.length > 0) {
            const AddressTile = sdk.getComponent("elements.AddressTile");
            for (let i = 0; i < this.state.selectedList.length; i++) {
                query.push(
                    <AddressTile
                        key={i}
                        address={this.state.selectedList[i]}
                        canDismiss={true}
                        onDismissed={this.onDismissed(i)}
                        showAddress={this.props.pickerType === 'user'} />,
                );
            }
        }

        // Add the query at the end
        query.push(
            <textarea
                key={this.state.selectedList.length}
                onPaste={this._onPaste}
                rows="1"
                id="textinput"
                ref={this._textinput}
                className="mx_AddressPickerDialog_input"
                onChange={this.onQueryChanged}
                placeholder={this.getPlaceholder()}
                defaultValue={this.props.value}
                autoFocus={this.props.focus}>
            </textarea>,
        );

        const filteredSuggestedList = this._getFilteredSuggestions();

        let error;
        let addressSelector;
        if (this.state.invalidAddressError) {
            const validTypeDescriptions = this.state.validAddressTypes.map((t) => _t(addressTypeName[t]));
            error = <div className="mx_AddressPickerDialog_error">
                { _t("You have entered an invalid address.") }
                <br />
                { _t("Try using one of the following valid address types: %(validTypesList)s.", {
                    validTypesList: validTypeDescriptions.join(", "),
                }) }
            </div>;
        } else if (this.state.searchError) {
            error = <div className="mx_AddressPickerDialog_error">{ this.state.searchError }</div>;
        } else if (this.state.query.length > 0 && filteredSuggestedList.length === 0 && !this.state.busy) {
            error = <div className="mx_AddressPickerDialog_error">{ _t("No results") }</div>;
        } else {
            addressSelector = (
                <AddressSelector ref={(ref) => {this.addressSelector = ref;}}
                    addressList={filteredSuggestedList}
                    showAddress={this.props.pickerType === 'user'}
                    onSelected={this.onSelected}
                    truncateAt={TRUNCATE_QUERY_LIST}
                />
            );
        }

        let identityServer;
        // If picker cannot currently accept e-mail but should be able to
        if (this.props.pickerType === 'user' && !this.state.validAddressTypes.includes('email')
            && this.props.validAddressTypes.includes('email')) {
            const defaultIdentityServerUrl = getDefaultIdentityServerUrl();
            if (defaultIdentityServerUrl) {
                identityServer = <div className="mx_AddressPickerDialog_identityServer">{_t(
                    "Use an identity server to invite by email. " +
                    "<default>Use the default (%(defaultIdentityServerName)s)</default> " +
                    "or manage in <settings>Settings</settings>.",
                    {
                        defaultIdentityServerName: abbreviateUrl(defaultIdentityServerUrl),
                    },
                    {
                        default: sub => <a href="#" onClick={this.onUseDefaultIdentityServerClick}>{sub}</a>,
                        settings: sub => <a href="#" onClick={this.onManageSettingsClick}>{sub}</a>,
                    },
                )}</div>;
            } else {
                identityServer = <div className="mx_AddressPickerDialog_identityServer">{_t(
                    "Use an identity server to invite by email. " +
                    "Manage in <settings>Settings</settings>.",
                    {}, {
                        settings: sub => <a href="#" onClick={this.onManageSettingsClick}>{sub}</a>,
                    },
                )}</div>;
            }
        }

        return (
            <BaseDialog className="mx_AddressPickerDialog" onKeyDown={this.onKeyDown}
                onFinished={this.props.onFinished} title={this.props.title}>
                {inputLabel}
                <div className="mx_Dialog_content">
                    <div className="mx_AddressPickerDialog_inputContainer">{ query }</div>
                    { error }
                    { addressSelector }
                    { this.props.extraNode }
                    { identityServer }
                </div>
                <DialogButtons primaryButton={this.props.button}
                    onPrimaryButtonClick={this.onButtonClick}
                    onCancel={this.onCancel} />
            </BaseDialog>
        );
    }
}
