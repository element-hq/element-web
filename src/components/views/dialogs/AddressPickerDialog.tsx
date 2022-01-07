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

import React, { createRef } from 'react';
import { sleep } from "matrix-js-sdk/src/utils";
import { logger } from "matrix-js-sdk/src/logger";

import { _t, _td } from '../../../languageHandler';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import dis from '../../../dispatcher/dispatcher';
import { AddressType, addressTypes, getAddressType, IUserAddress } from '../../../UserAddress';
import GroupStore from '../../../stores/GroupStore';
import * as Email from '../../../email';
import IdentityAuthClient from '../../../IdentityAuthClient';
import { getDefaultIdentityServerUrl, useDefaultIdentityServer } from '../../../utils/IdentityServerUtils';
import { abbreviateUrl } from '../../../utils/UrlUtils';
import { Key } from "../../../Keyboard";
import { Action } from "../../../dispatcher/actions";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import AddressSelector from '../elements/AddressSelector';
import AddressTile from '../elements/AddressTile';
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import AccessibleButton from '../elements/AccessibleButton';

const TRUNCATE_QUERY_LIST = 40;
const QUERY_USER_DIRECTORY_DEBOUNCE_MS = 200;

const addressTypeName = {
    'mx-user-id': _td("Matrix ID"),
    'mx-room-id': _td("Matrix Room ID"),
    'email': _td("email address"),
};

interface IResult {
    user_id: string; // eslint-disable-line camelcase
    room_id?: string; // eslint-disable-line camelcase
    name?: string;
    display_name?: string; // eslint-disable-line camelcase
    avatar_url?: string;// eslint-disable-line camelcase
}

interface IProps {
    title: string;
    description?: JSX.Element;
    // Extra node inserted after picker input, dropdown and errors
    extraNode?: JSX.Element;
    value?: string;
    placeholder?: ((validAddressTypes: any) => string) | string;
    roomId?: string;
    button?: string;
    focus?: boolean;
    validAddressTypes?: AddressType[];
    onFinished: (success: boolean, list?: IUserAddress[]) => void;
    groupId?: string;
    // The type of entity to search for. Default: 'user'.
    pickerType?: 'user' | 'room';
    // Whether the current user should be included in the addresses returned. Only
    // applicable when pickerType is `user`. Default: false.
    includeSelf?: boolean;
}

interface IState {
    // Whether to show an error message because of an invalid address
    invalidAddressError: boolean;
    // List of UserAddressType objects representing
    // the list of addresses we're going to invite
    selectedList: IUserAddress[];
    // Whether a search is ongoing
    busy: boolean;
    // An error message generated during the user directory search
    searchError: string;
    // Whether the server supports the user_directory API
    serverSupportsUserDirectory: boolean;
    // The query being searched for
    query: string;
    // List of UserAddressType objects representing the set of
    // auto-completion results for the current search query.
    suggestedList: IUserAddress[];
    // List of address types initialised from props, but may change while the
    // dialog is open and represents the supported list of address types at this time.
    validAddressTypes: AddressType[];
}

@replaceableComponent("views.dialogs.AddressPickerDialog")
export default class AddressPickerDialog extends React.Component<IProps, IState> {
    private textinput = createRef<HTMLTextAreaElement>();
    private addressSelector = createRef<AddressSelector>();
    private queryChangedDebouncer: number;
    private cancelThreepidLookup: () => void;

    static defaultProps: Partial<IProps> = {
        value: "",
        focus: true,
        validAddressTypes: addressTypes,
        pickerType: 'user',
        includeSelf: false,
    };

    constructor(props: IProps) {
        super(props);

        let validAddressTypes = this.props.validAddressTypes;
        // Remove email from validAddressTypes if no IS is configured. It may be added at a later stage by the user
        if (!MatrixClientPeg.get().getIdentityServerUrl() && validAddressTypes.includes(AddressType.Email)) {
            validAddressTypes = validAddressTypes.filter(type => type !== AddressType.Email);
        }

        this.state = {
            invalidAddressError: false,
            selectedList: [],
            busy: false,
            searchError: null,
            serverSupportsUserDirectory: true,
            query: "",
            suggestedList: [],
            validAddressTypes,
        };
    }

    componentDidMount() {
        if (this.props.focus) {
            // Set the cursor at the end of the text input
            this.textinput.current.value = this.props.value;
        }
    }

    private getPlaceholder(): string {
        const { placeholder } = this.props;
        if (typeof placeholder === "string") {
            return placeholder;
        }
        // Otherwise it's a function, as checked by prop types.
        return placeholder(this.state.validAddressTypes);
    }

    private onButtonClick = (): void => {
        let selectedList = this.state.selectedList.slice();
        // Check the text input field to see if user has an unconverted address
        // If there is and it's valid add it to the local selectedList
        if (this.textinput.current.value !== '') {
            selectedList = this.addAddressesToList([this.textinput.current.value]);
            if (selectedList === null) return;
        }
        this.props.onFinished(true, selectedList);
    };

    private onCancel = (): void => {
        this.props.onFinished(false);
    };

    private onKeyDown = (e: React.KeyboardEvent): void => {
        const textInput = this.textinput.current ? this.textinput.current.value : undefined;

        if (e.key === Key.ESCAPE) {
            e.stopPropagation();
            e.preventDefault();
            this.props.onFinished(false);
        } else if (e.key === Key.ARROW_UP) {
            e.stopPropagation();
            e.preventDefault();
            if (this.addressSelector.current) this.addressSelector.current.moveSelectionUp();
        } else if (e.key === Key.ARROW_DOWN) {
            e.stopPropagation();
            e.preventDefault();
            if (this.addressSelector.current) this.addressSelector.current.moveSelectionDown();
        } else if (this.state.suggestedList.length > 0 && [Key.COMMA, Key.ENTER, Key.TAB].includes(e.key)) {
            e.stopPropagation();
            e.preventDefault();
            if (this.addressSelector.current) this.addressSelector.current.chooseSelection();
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
                this.addAddressesToList([textInput]);
            }
        } else if (textInput && (e.key === Key.COMMA || e.key === Key.TAB)) {
            e.stopPropagation();
            e.preventDefault();
            this.addAddressesToList([textInput]);
        }
    };

    private onQueryChanged = (ev: React.ChangeEvent): void => {
        const query = (ev.target as HTMLTextAreaElement).value;
        if (this.queryChangedDebouncer) {
            clearTimeout(this.queryChangedDebouncer);
        }
        // Only do search if there is something to search
        if (query.length > 0 && query !== '@' && query.length >= 2) {
            this.queryChangedDebouncer = setTimeout(() => {
                if (this.props.pickerType === 'user') {
                    if (this.props.groupId) {
                        this.doNaiveGroupSearch(query);
                    } else if (this.state.serverSupportsUserDirectory) {
                        this.doUserDirectorySearch(query);
                    } else {
                        this.doLocalSearch(query);
                    }
                } else if (this.props.pickerType === 'room') {
                    if (this.props.groupId) {
                        this.doNaiveGroupRoomSearch(query);
                    } else {
                        this.doRoomSearch(query);
                    }
                } else {
                    logger.error('Unknown pickerType', this.props.pickerType);
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

    private onDismissed = (index: number) => () => {
        const selectedList = this.state.selectedList.slice();
        selectedList.splice(index, 1);
        this.setState({
            selectedList,
            suggestedList: [],
            query: "",
        });
        if (this.cancelThreepidLookup) this.cancelThreepidLookup();
    };

    private onSelected = (index: number): void => {
        const selectedList = this.state.selectedList.slice();
        selectedList.push(this.getFilteredSuggestions()[index]);
        this.setState({
            selectedList,
            suggestedList: [],
            query: "",
        });
        if (this.cancelThreepidLookup) this.cancelThreepidLookup();
    };

    private doNaiveGroupSearch(query: string): void {
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
            this.processResults(results, query);
        }).catch((err) => {
            logger.error('Error whilst searching group rooms: ', err);
            this.setState({
                searchError: err.errcode ? err.message : _t('Something went wrong!'),
            });
        }).then(() => {
            this.setState({
                busy: false,
            });
        });
    }

    private doNaiveGroupRoomSearch(query: string): void {
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
        this.processResults(results, query);
        this.setState({
            busy: false,
        });
    }

    private doRoomSearch(query: string): void {
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

        this.processResults(sortedResults, query);
        this.setState({
            busy: false,
        });
    }

    private doUserDirectorySearch(query: string): void {
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
            this.processResults(resp.results, query);
        }).catch((err) => {
            logger.error('Error whilst searching user directory: ', err);
            this.setState({
                searchError: err.errcode ? err.message : _t('Something went wrong!'),
            });
            if (err.errcode === 'M_UNRECOGNIZED') {
                this.setState({
                    serverSupportsUserDirectory: false,
                });
                // Do a local search immediately
                this.doLocalSearch(query);
            }
        }).then(() => {
            this.setState({
                busy: false,
            });
        });
    }

    private doLocalSearch(query: string): void {
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
        this.processResults(results, query);
    }

    private processResults(results: IResult[], query: string): void {
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
                this.setState({ searchError: _t("That doesn't look like a valid email address") });
                return;
            }
            suggestedList.unshift({
                addressType: addrType,
                address: query,
                isKnown: false,
            });
            if (this.cancelThreepidLookup) this.cancelThreepidLookup();
            if (addrType === 'email') {
                this.lookupThreepid(addrType, query);
            }
        }
        this.setState({
            suggestedList,
            invalidAddressError: false,
        }, () => {
            if (this.addressSelector.current) this.addressSelector.current.moveSelectionTop();
        });
    }

    private addAddressesToList(addressTexts: string[]): IUserAddress[] {
        const selectedList = this.state.selectedList.slice();

        let hasError = false;
        addressTexts.forEach((addressText) => {
            addressText = addressText.trim();
            const addrType = getAddressType(addressText);
            const addrObj: IUserAddress = {
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
        if (this.cancelThreepidLookup) this.cancelThreepidLookup();
        return hasError ? null : selectedList;
    }

    private async lookupThreepid(medium: AddressType, address: string): Promise<string> {
        let cancelled = false;
        // Note that we can't safely remove this after we're done
        // because we don't know that it's the same one, so we just
        // leave it: it's replacing the old one each time so it's
        // not like they leak.
        this.cancelThreepidLookup = function() {
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
            logger.error(e);
            this.setState({
                searchError: _t('Something went wrong!'),
            });
        }
    }

    private getFilteredSuggestions(): IUserAddress[] {
        // map addressType => set of addresses to avoid O(n*m) operation
        const selectedAddresses = {};
        this.state.selectedList.forEach(({ address, addressType }) => {
            if (!selectedAddresses[addressType]) selectedAddresses[addressType] = new Set();
            selectedAddresses[addressType].add(address);
        });

        // Filter out any addresses in the above already selected addresses (matching both type and address)
        return this.state.suggestedList.filter(({ address, addressType }) => {
            return !(selectedAddresses[addressType] && selectedAddresses[addressType].has(address));
        });
    }

    private onPaste = (e: React.ClipboardEvent): void => {
        // Prevent the text being pasted into the textarea
        e.preventDefault();
        const text = e.clipboardData.getData("text");
        // Process it as a list of addresses to add instead
        this.addAddressesToList(text.split(/[\s,]+/));
    };

    private onUseDefaultIdentityServerClick = (e: React.MouseEvent): void => {
        e.preventDefault();

        // Update the IS in account data. Actually using it may trigger terms.
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useDefaultIdentityServer();

        // Add email as a valid address type.
        const { validAddressTypes } = this.state;
        validAddressTypes.push(AddressType.Email);
        this.setState({ validAddressTypes });
    };

    private onManageSettingsClick = (e: React.MouseEvent): void => {
        e.preventDefault();
        dis.fire(Action.ViewUserSettings);
        this.onCancel();
    };

    render() {
        let inputLabel;
        if (this.props.description) {
            inputLabel = <div className="mx_AddressPickerDialog_label">
                <label htmlFor="textinput">{ this.props.description }</label>
            </div>;
        }

        const query = [];
        // create the invite list
        if (this.state.selectedList.length > 0) {
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
                onPaste={this.onPaste}
                rows={1}
                id="textinput"
                ref={this.textinput}
                className="mx_AddressPickerDialog_input"
                onChange={this.onQueryChanged}
                placeholder={this.getPlaceholder()}
                defaultValue={this.props.value}
                autoFocus={this.props.focus}
            />,
        );

        const filteredSuggestedList = this.getFilteredSuggestions();

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
                <AddressSelector ref={this.addressSelector}
                    addressList={filteredSuggestedList}
                    showAddress={this.props.pickerType === 'user'}
                    onSelected={this.onSelected}
                    truncateAt={TRUNCATE_QUERY_LIST}
                />
            );
        }

        let identityServer;
        // If picker cannot currently accept e-mail but should be able to
        if (this.props.pickerType === 'user' && !this.state.validAddressTypes.includes(AddressType.Email)
            && this.props.validAddressTypes.includes(AddressType.Email)) {
            const defaultIdentityServerUrl = getDefaultIdentityServerUrl();
            if (defaultIdentityServerUrl) {
                identityServer = <div className="mx_AddressPickerDialog_identityServer">{ _t(
                    "Use an identity server to invite by email. " +
                    "<default>Use the default (%(defaultIdentityServerName)s)</default> " +
                    "or manage in <settings>Settings</settings>.",
                    {
                        defaultIdentityServerName: abbreviateUrl(defaultIdentityServerUrl),
                    },
                    {
                        default: sub => (
                            <AccessibleButton kind="link_inline" onClick={this.onUseDefaultIdentityServerClick}>
                                { sub }
                            </AccessibleButton>
                        ),
                        settings: sub => <AccessibleButton kind="link_inline" onClick={this.onManageSettingsClick}>
                            { sub }
                        </AccessibleButton>,
                    },
                ) }</div>;
            } else {
                identityServer = <div className="mx_AddressPickerDialog_identityServer">{ _t(
                    "Use an identity server to invite by email. " +
                    "Manage in <settings>Settings</settings>.",
                    {}, {
                        settings: sub => <AccessibleButton kind="link_inline" onClick={this.onManageSettingsClick}>
                            { sub }
                        </AccessibleButton>,
                    },
                ) }</div>;
            }
        }

        return (
            <BaseDialog
                className="mx_AddressPickerDialog"
                onKeyDown={this.onKeyDown}
                onFinished={this.props.onFinished}
                title={this.props.title}
            >
                { inputLabel }
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
