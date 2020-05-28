/*
Copyright 2016 OpenMarket Ltd
Copyright 2018, 2019 New Vector Ltd

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

import EditableItemList from "../elements/EditableItemList";
import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import * as sdk from "../../../index";
import { _t } from '../../../languageHandler';
import Field from "../elements/Field";
import ErrorDialog from "../dialogs/ErrorDialog";
import AccessibleButton from "../elements/AccessibleButton";
import Modal from "../../../Modal";
import RoomPublishSetting from "./RoomPublishSetting";

class EditableAliasesList extends EditableItemList {
    constructor(props) {
        super(props);

        this._aliasField = createRef();
    }

    _onAliasAdded = async () => {
        await this._aliasField.current.validate({ allowEmpty: false });

        if (this._aliasField.current.isValid) {
            if (this.props.onItemAdded) this.props.onItemAdded(this.props.newItem);
            return;
        }

        this._aliasField.current.focus();
        this._aliasField.current.validate({ allowEmpty: false, focused: true });
    };

    _renderNewItemField() {
        // if we don't need the RoomAliasField,
        // we don't need to overriden version of _renderNewItemField
        if (!this.props.domain) {
            return super._renderNewItemField();
        }
        const RoomAliasField = sdk.getComponent('views.elements.RoomAliasField');
        const onChange = (alias) => this._onNewItemChanged({target: {value: alias}});
        return (
            <form
                onSubmit={this._onAliasAdded}
                autoComplete="off"
                noValidate={true}
                className="mx_EditableItemList_newItem"
            >
                <RoomAliasField
                    ref={this._aliasField}
                    onChange={onChange}
                    value={this.props.newItem || ""}
                    domain={this.props.domain} />
                <AccessibleButton onClick={this._onAliasAdded} kind="primary">
                    { _t("Add") }
                </AccessibleButton>
            </form>
        );
    }
}

export default class AliasSettings extends React.Component {
    static propTypes = {
        roomId: PropTypes.string.isRequired,
        canSetCanonicalAlias: PropTypes.bool.isRequired,
        canSetAliases: PropTypes.bool.isRequired,
        canonicalAliasEvent: PropTypes.object, // MatrixEvent
    };

    static defaultProps = {
        canSetAliases: false,
        canSetCanonicalAlias: false,
        aliasEvents: [],
    };

    constructor(props) {
        super(props);

        const state = {
            altAliases: [], // [ #alias:domain.tld, ... ]
            localAliases: [], // [ #alias:my-hs.tld, ... ]
            canonicalAlias: null, // #canonical:domain.tld
            updatingCanonicalAlias: false,
            localAliasesLoading: false,
            detailsOpen: false,
        };

        if (props.canonicalAliasEvent) {
            const content = props.canonicalAliasEvent.getContent();
            const altAliases = content.alt_aliases;
            if (Array.isArray(altAliases)) {
                state.altAliases = altAliases.slice();
            }
            state.canonicalAlias = content.alias;
        }

        this.state = state;
    }

    componentDidMount() {
        if (this.props.canSetCanonicalAlias) {
            // load local aliases for providing recommendations
            // for the canonical alias and alt_aliases
            this.loadLocalAliases();
        }
    }

    async loadLocalAliases() {
        this.setState({ localAliasesLoading: true });
        try {
            const cli = MatrixClientPeg.get();
            let localAliases = [];
            if (await cli.doesServerSupportUnstableFeature("org.matrix.msc2432")) {
                const response = await cli.unstableGetLocalAliases(this.props.roomId);
                if (Array.isArray(response.aliases)) {
                    localAliases = response.aliases;
                }
            }
            this.setState({ localAliases });
        } finally {
            this.setState({ localAliasesLoading: false });
        }
    }

    changeCanonicalAlias(alias) {
        if (!this.props.canSetCanonicalAlias) return;

        const oldAlias = this.state.canonicalAlias;
        this.setState({
            canonicalAlias: alias,
            updatingCanonicalAlias: true,
        });

        const eventContent = {
            alt_aliases: this.state.altAliases,
        };

        if (alias) eventContent["alias"] = alias;

        MatrixClientPeg.get().sendStateEvent(this.props.roomId, "m.room.canonical_alias",
            eventContent, "").catch((err) => {
            console.error(err);
            Modal.createTrackedDialog('Error updating main address', '', ErrorDialog, {
                title: _t("Error updating main address"),
                description: _t(
                    "There was an error updating the room's main address. It may not be allowed by the server " +
                    "or a temporary failure occurred.",
                ),
            });
            this.setState({canonicalAlias: oldAlias});
        }).finally(() => {
            this.setState({updatingCanonicalAlias: false});
        });
    }

    changeAltAliases(altAliases) {
        if (!this.props.canSetCanonicalAlias) return;

        this.setState({
            updatingCanonicalAlias: true,
            altAliases,
        });

        const eventContent = {};

        if (this.state.canonicalAlias) {
            eventContent.alias = this.state.canonicalAlias;
        }
        if (altAliases) {
            eventContent["alt_aliases"] = altAliases;
        }

        MatrixClientPeg.get().sendStateEvent(this.props.roomId, "m.room.canonical_alias",
            eventContent, "").catch((err) => {
            console.error(err);
            Modal.createTrackedDialog('Error updating alternative addresses', '', ErrorDialog, {
                title: _t("Error updating main address"),
                description: _t(
                    "There was an error updating the room's alternative addresses. " +
                    "It may not be allowed by the server or a temporary failure occurred.",
                ),
            });
        }).finally(() => {
            this.setState({updatingCanonicalAlias: false});
        });
    }

    onNewAliasChanged = (value) => {
        this.setState({newAlias: value});
    };

    onLocalAliasAdded = (alias) => {
        if (!alias || alias.length === 0) return; // ignore attempts to create blank aliases

        const localDomain = MatrixClientPeg.get().getDomain();
        if (!alias.includes(':')) alias += ':' + localDomain;

        MatrixClientPeg.get().createAlias(alias, this.props.roomId).then(() => {
            this.setState({
                localAliases: this.state.localAliases.concat(alias),
                newAlias: null,
            });
            if (!this.state.canonicalAlias) {
                this.changeCanonicalAlias(alias);
            }
        }).catch((err) => {
            console.error(err);
            Modal.createTrackedDialog('Error creating address', '', ErrorDialog, {
                title: _t("Error creating address"),
                description: _t(
                    "There was an error creating that address. It may not be allowed by the server " +
                    "or a temporary failure occurred.",
                ),
            });
        });
    };

    onLocalAliasDeleted = (index) => {
        const alias = this.state.localAliases[index];
        // TODO: In future, we should probably be making sure that the alias actually belongs
        // to this room. See https://github.com/vector-im/riot-web/issues/7353
        MatrixClientPeg.get().deleteAlias(alias).then(() => {
            const localAliases = this.state.localAliases.filter(a => a !== alias);
            this.setState({localAliases});

            if (this.state.canonicalAlias === alias) {
                this.changeCanonicalAlias(null);
            }
        }).catch((err) => {
            console.error(err);
            let description;
            if (err.errcode === "M_FORBIDDEN") {
                description = _t("You don't have permission to delete the address.");
            } else {
                description = _t(
                    "There was an error removing that address. It may no longer exist or a temporary " +
                    "error occurred.",
                );
            }
            Modal.createTrackedDialog('Error removing address', '', ErrorDialog, {
                title: _t("Error removing address"),
                description,
            });
        });
    };

    onLocalAliasesToggled = (event) => {
        // expanded
        if (event.target.open) {
            // if local aliases haven't been preloaded yet at component mount
            if (!this.props.canSetCanonicalAlias && this.state.localAliases.length === 0) {
                this.loadLocalAliases();
            }
        }
        this.setState({detailsOpen: event.target.open});
    };

    onCanonicalAliasChange = (event) => {
        this.changeCanonicalAlias(event.target.value);
    };

    onNewAltAliasChanged = (value) => {
        this.setState({newAltAlias: value});
    }

    onAltAliasAdded = (alias) => {
        const altAliases = this.state.altAliases.slice();
        if (!altAliases.some(a => a.trim() === alias.trim())) {
            altAliases.push(alias.trim());
            this.changeAltAliases(altAliases);
            this.setState({newAltAlias: ""});
        }
    }

    onAltAliasDeleted = (index) => {
        const altAliases = this.state.altAliases.slice();
        altAliases.splice(index, 1);
        this.changeAltAliases(altAliases);
    }

    _getAliases() {
        return this.state.altAliases.concat(this._getLocalNonAltAliases());
    }

    _getLocalNonAltAliases() {
        const {altAliases} = this.state;
        return this.state.localAliases.filter(alias => !altAliases.includes(alias));
    }

    render() {
        const localDomain = MatrixClientPeg.get().getDomain();

        let found = false;
        const canonicalValue = this.state.canonicalAlias || "";
        const canonicalAliasSection = (
            <Field onChange={this.onCanonicalAliasChange} value={canonicalValue}
                   disabled={this.state.updatingCanonicalAlias || !this.props.canSetCanonicalAlias}
                   element='select' id='canonicalAlias' label={_t('Main address')}>
                <option value="" key="unset">{ _t('not specified') }</option>
                {
                    this._getAliases().map((alias, i) => {
                        if (alias === this.state.canonicalAlias) found = true;
                        return (
                            <option value={alias} key={i}>
                                { alias }
                            </option>
                        );
                    })
                }
                {
                    found || !this.state.canonicalAlias ? '' :
                    <option value={ this.state.canonicalAlias } key='arbitrary'>
                        { this.state.canonicalAlias }
                    </option>
                }
            </Field>
        );

        let localAliasesList;
        if (this.state.localAliasesLoading) {
            const Spinner = sdk.getComponent("elements.Spinner");
            localAliasesList = <Spinner />;
        } else {
            localAliasesList = (<EditableAliasesList
                id="roomAliases"
                className={"mx_RoomSettings_localAliases"}
                items={this.state.localAliases}
                newItem={this.state.newAlias}
                onNewItemChanged={this.onNewAliasChanged}
                canRemove={this.props.canSetAliases}
                canEdit={this.props.canSetAliases}
                onItemAdded={this.onLocalAliasAdded}
                onItemRemoved={this.onLocalAliasDeleted}
                noItemsLabel={_t('This room has no local addresses')}
                placeholder={_t('Local address')}
                domain={localDomain}
            />);
        }

        return (
            <div className='mx_AliasSettings'>
                <span className='mx_SettingsTab_subheading'>{_t("Published Addresses")}</span>
                <p>{_t("Published addresses can be used by anyone on any server to join your room. " +
                    "To publish an address, it needs to be set as a local address first.")}</p>
                {canonicalAliasSection}
                <RoomPublishSetting roomId={this.props.roomId} canSetCanonicalAlias={this.props.canSetCanonicalAlias} />
                <datalist id="mx_AliasSettings_altRecommendations">
                    {this._getLocalNonAltAliases().map(alias => {
                        return <option value={alias} key={alias} />;
                    })};
                </datalist>
                <EditableAliasesList
                    id="roomAltAliases"
                    className={"mx_RoomSettings_altAliases"}
                    items={this.state.altAliases}
                    newItem={this.state.newAltAlias}
                    onNewItemChanged={this.onNewAltAliasChanged}
                    canRemove={this.props.canSetCanonicalAlias}
                    canEdit={this.props.canSetCanonicalAlias}
                    onItemAdded={this.onAltAliasAdded}
                    onItemRemoved={this.onAltAliasDeleted}
                    suggestionsListId="mx_AliasSettings_altRecommendations"
                    itemsLabel={_t('Other published addresses:')}
                    noItemsLabel={_t('No other published addresses yet, add one below')}
                    placeholder={_t('New published address (e.g. #alias:server)')}
                />
                <span className='mx_SettingsTab_subheading mx_AliasSettings_localAliasHeader'>{_t("Local Addresses")}</span>
                <p>{_t("Set addresses for this room so users can find this room through your homeserver (%(localDomain)s)", {localDomain})}</p>
                <details onToggle={this.onLocalAliasesToggled}>
                    <summary>{ this.state.detailsOpen ? _t('Show less') : _t("Show more")}</summary>
                    {localAliasesList}
                </details>
            </div>
        );
    }
}
