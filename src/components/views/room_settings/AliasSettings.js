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

const React = require('react');
import PropTypes from 'prop-types';
const MatrixClientPeg = require('../../../MatrixClientPeg');
const sdk = require("../../../index");
import { _t } from '../../../languageHandler';
import Field from "../elements/Field";
import ErrorDialog from "../dialogs/ErrorDialog";
const Modal = require("../../../Modal");

export default class AliasSettings extends React.Component {
    static propTypes = {
        roomId: PropTypes.string.isRequired,
        canSetCanonicalAlias: PropTypes.bool.isRequired,
        canSetAliases: PropTypes.bool.isRequired,
        aliasEvents: PropTypes.array, // [MatrixEvent]
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
            domainToAliases: {}, // { domain.com => [#alias1:domain.com, #alias2:domain.com] }
            remoteDomains: [], // [ domain.com, foobar.com ]
            canonicalAlias: null, // #canonical:domain.com
            updatingCanonicalAlias: false,
            newItem: "",
        };

        const localDomain = MatrixClientPeg.get().getDomain();
        state.domainToAliases = this.aliasEventsToDictionary(props.aliasEvents || []);
        state.remoteDomains = Object.keys(state.domainToAliases).filter((domain) => {
            return domain !== localDomain && state.domainToAliases[domain].length > 0;
        });

        if (props.canonicalAliasEvent) {
            state.canonicalAlias = props.canonicalAliasEvent.getContent().alias;
        }

        this.state = state;
    }

    aliasEventsToDictionary(aliasEvents) { // m.room.alias events
        const dict = {};
        aliasEvents.forEach((event) => {
            dict[event.getStateKey()] = (
                (event.getContent().aliases || []).slice() // shallow-copy
            );
        });
        return dict;
    }

    isAliasValid(alias) {
        // XXX: FIXME https://github.com/matrix-org/matrix-doc/issues/668
        return (alias.match(/^#([^/:,]+?):(.+)$/) && encodeURI(alias) === alias);
    }

    changeCanonicalAlias(alias) {
        if (!this.props.canSetCanonicalAlias) return;

        this.setState({
            canonicalAlias: alias,
            updatingCanonicalAlias: true,
        });

        const eventContent = {};
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
        if (this.isAliasValid(alias) && alias.endsWith(localDomain)) {
            MatrixClientPeg.get().createAlias(alias, this.props.roomId).then(() => {
                const localAliases = this.state.domainToAliases[localDomain] || [];
                const domainAliases = Object.assign({}, this.state.domainToAliases);
                domainAliases[localDomain] = [...localAliases, alias];

                this.setState({
                    domainToAliases: domainAliases,
                    // Reset the add field
                    newAlias: "",
                });

                if (!this.state.canonicalAlias) {
                    this.changeCanonicalAlias(alias);
                }
            }).catch((err) => {
                console.error(err);
                Modal.createTrackedDialog('Error creating alias', '', ErrorDialog, {
                    title: _t("Error creating alias"),
                    description: _t(
                        "There was an error creating that alias. It may not be allowed by the server " +
                        "or a temporary failure occurred.",
                    ),
                });
            });
        } else {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Invalid alias format', '', ErrorDialog, {
                title: _t('Invalid alias format'),
                description: _t('\'%(alias)s\' is not a valid format for an alias', { alias: alias }),
            });
        }
    };

    onLocalAliasDeleted = (index) => {
        const localDomain = MatrixClientPeg.get().getDomain();

        const alias = this.state.domainToAliases[localDomain][index];

        // TODO: In future, we should probably be making sure that the alias actually belongs
        // to this room. See https://github.com/vector-im/riot-web/issues/7353
        MatrixClientPeg.get().deleteAlias(alias).then(() => {
            const localAliases = this.state.domainToAliases[localDomain].filter((a) => a !== alias);
            const domainAliases = Object.assign({}, this.state.domainToAliases);
            domainAliases[localDomain] = localAliases;

            this.setState({domainToAliases: domainAliases});

            if (this.state.canonicalAlias === alias) {
                this.changeCanonicalAlias(null);
            }
        }).catch((err) => {
            console.error(err);
            Modal.createTrackedDialog('Error removing alias', '', ErrorDialog, {
                title: _t("Error removing alias"),
                description: _t(
                    "There was an error removing that alias. It may no longer exist or a temporary " +
                    "error occurred.",
                ),
            });
        });
    };

    onCanonicalAliasChange = (event) => {
        this.changeCanonicalAlias(event.target.value);
    };

    render() {
        const EditableItemList = sdk.getComponent("elements.EditableItemList");
        const localDomain = MatrixClientPeg.get().getDomain();

        let found = false;
        const canonicalValue = this.state.canonicalAlias || "";
        const canonicalAliasSection = (
            <Field onChange={this.onCanonicalAliasChange} value={canonicalValue}
                   disabled={this.state.updatingCanonicalAlias || !this.props.canSetCanonicalAlias}
                   element='select' id='canonicalAlias' label={_t('Main address')}>
                <option value="" key="unset">{ _t('not specified') }</option>
                {
                    Object.keys(this.state.domainToAliases).map((domain, i) => {
                        return this.state.domainToAliases[domain].map((alias, j) => {
                            if (alias === this.state.canonicalAlias) found = true;
                            return (
                                <option value={alias} key={i + "_" + j}>
                                    { alias }
                                </option>
                            );
                        });
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

        let remoteAliasesSection;
        if (this.state.remoteDomains.length) {
            remoteAliasesSection = (
                <div>
                    <div>
                        { _t("Remote addresses for this room:") }
                    </div>
                    <ul>
                        { this.state.remoteDomains.map((domain, i) => {
                            return this.state.domainToAliases[domain].map((alias, j) => {
                                return <li key={i + "_" + j}>{alias}</li>;
                            });
                        }) }
                    </ul>
                </div>
            );
        }

        return (
            <div className='mx_AliasSettings'>
                {canonicalAliasSection}
                <EditableItemList
                    className={"mx_RoomSettings_localAliases"}
                    items={this.state.domainToAliases[localDomain] || []}
                    newItem={this.state.newAlias}
                    onNewItemChanged={this.onNewAliasChanged}
                    canRemove={this.props.canSetAliases}
                    canEdit={this.props.canSetAliases}
                    onItemAdded={this.onLocalAliasAdded}
                    onItemRemoved={this.onLocalAliasDeleted}
                    itemsLabel={_t('Local addresses for this room:')}
                    noItemsLabel={_t('This room has no local addresses')}
                    placeholder={_t(
                        'New address (e.g. #foo:%(localDomain)s)', {localDomain: localDomain},
                    )}
                />
                {remoteAliasesSection}
            </div>
        );
    }
}
