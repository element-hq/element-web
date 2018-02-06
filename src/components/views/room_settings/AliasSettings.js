/*
Copyright 2016 OpenMarket Ltd

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

import Promise from 'bluebird';
const React = require('react');
import PropTypes from 'prop-types';
const ObjectUtils = require("../../../ObjectUtils");
const MatrixClientPeg = require('../../../MatrixClientPeg');
const sdk = require("../../../index");
import { _t } from '../../../languageHandler';
const Modal = require("../../../Modal");

module.exports = React.createClass({
    displayName: 'AliasSettings',

    propTypes: {
        roomId: PropTypes.string.isRequired,
        canSetCanonicalAlias: PropTypes.bool.isRequired,
        canSetAliases: PropTypes.bool.isRequired,
        aliasEvents: PropTypes.array, // [MatrixEvent]
        canonicalAliasEvent: PropTypes.object, // MatrixEvent
    },

    getDefaultProps: function() {
        return {
            canSetAliases: false,
            canSetCanonicalAlias: false,
            aliasEvents: [],
        };
    },

    getInitialState: function() {
        return this.recalculateState(this.props.aliasEvents, this.props.canonicalAliasEvent);
    },

    recalculateState: function(aliasEvents, canonicalAliasEvent) {
        aliasEvents = aliasEvents || [];

        const state = {
            domainToAliases: {}, // { domain.com => [#alias1:domain.com, #alias2:domain.com] }
            remoteDomains: [], // [ domain.com, foobar.com ]
            canonicalAlias: null, // #canonical:domain.com
        };
        const localDomain = MatrixClientPeg.get().getDomain();

        state.domainToAliases = this.aliasEventsToDictionary(aliasEvents);

        state.remoteDomains = Object.keys(state.domainToAliases).filter((domain) => {
            return domain !== localDomain && state.domainToAliases[domain].length > 0;
        });

        if (canonicalAliasEvent) {
            state.canonicalAlias = canonicalAliasEvent.getContent().alias;
        }

        return state;
    },

    saveSettings: function() {
        let promises = [];

        // save new aliases for m.room.aliases
        const aliasOperations = this.getAliasOperations();
        for (let i = 0; i < aliasOperations.length; i++) {
            const alias_operation = aliasOperations[i];
            console.log("alias %s %s", alias_operation.place, alias_operation.val);
            switch (alias_operation.place) {
                case 'add':
                    promises.push(
                        MatrixClientPeg.get().createAlias(
                            alias_operation.val, this.props.roomId,
                        ),
                    );
                    break;
                case 'del':
                    promises.push(
                        MatrixClientPeg.get().deleteAlias(
                            alias_operation.val,
                        ),
                    );
                    break;
                default:
                    console.log("Unknown alias operation, ignoring: " + alias_operation.place);
            }
        }


        // save new canonical alias
        let oldCanonicalAlias = null;
        if (this.props.canonicalAliasEvent) {
            oldCanonicalAlias = this.props.canonicalAliasEvent.getContent().alias;
        }
        if (oldCanonicalAlias !== this.state.canonicalAlias) {
            console.log("AliasSettings: Updating canonical alias");
            promises = [Promise.all(promises).then(
                MatrixClientPeg.get().sendStateEvent(
                    this.props.roomId, "m.room.canonical_alias", {
                        alias: this.state.canonicalAlias,
                    }, "",
                ),
            )];
        }

        return promises;
    },

    aliasEventsToDictionary: function(aliasEvents) { // m.room.alias events
        const dict = {};
        aliasEvents.forEach((event) => {
            dict[event.getStateKey()] = (
                (event.getContent().aliases || []).slice() // shallow-copy
            );
        });
        return dict;
    },

    isAliasValid: function(alias) {
        // XXX: FIXME SPEC-1
        return (alias.match(/^#([^\/:,]+?):(.+)$/) && encodeURI(alias) === alias);
    },

    getAliasOperations: function() {
        const oldAliases = this.aliasEventsToDictionary(this.props.aliasEvents);
        return ObjectUtils.getKeyValueArrayDiffs(oldAliases, this.state.domainToAliases);
    },

    onNewAliasChanged: function(value) {
        this.setState({newAlias: value});
    },

    onLocalAliasAdded: function(alias) {
        if (!alias || alias.length === 0) return; // ignore attempts to create blank aliases

        const localDomain = MatrixClientPeg.get().getDomain();
        if (this.isAliasValid(alias) && alias.endsWith(localDomain)) {
            this.state.domainToAliases[localDomain] = this.state.domainToAliases[localDomain] || [];
            this.state.domainToAliases[localDomain].push(alias);

            this.setState({
                domainToAliases: this.state.domainToAliases,
                // Reset the add field
                newAlias: "",
            });
        } else {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Invalid alias format', '', ErrorDialog, {
                title: _t('Invalid alias format'),
                description: _t('\'%(alias)s\' is not a valid format for an alias', { alias: alias }),
            });
        }
    },

    onLocalAliasChanged: function(alias, index) {
        if (alias === "") return; // hit the delete button to delete please
        const localDomain = MatrixClientPeg.get().getDomain();
        if (this.isAliasValid(alias) && alias.endsWith(localDomain)) {
            this.state.domainToAliases[localDomain][index] = alias;
        } else {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Invalid address format', '', ErrorDialog, {
                title: _t('Invalid address format'),
                description: _t('\'%(alias)s\' is not a valid format for an address', { alias: alias }),
            });
        }
    },

    onLocalAliasDeleted: function(index) {
        const localDomain = MatrixClientPeg.get().getDomain();
        // It's a bit naughty to directly manipulate this.state, and React would
        // normally whine at you, but it can't see us doing the splice.  Given we
        // promptly setState anyway, it's just about acceptable.  The alternative
        // would be to arbitrarily deepcopy to a temp variable and then setState
        // that, but why bother when we can cut this corner.
        this.state.domainToAliases[localDomain].splice(index, 1);
        this.setState({
            domainToAliases: this.state.domainToAliases,
        });
    },

    onCanonicalAliasChange: function(event) {
        this.setState({
            canonicalAlias: event.target.value,
        });
    },

    render: function() {
        const self = this;
        const EditableText = sdk.getComponent("elements.EditableText");
        const EditableItemList = sdk.getComponent("elements.EditableItemList");
        const localDomain = MatrixClientPeg.get().getDomain();

        let canonical_alias_section;
        if (this.props.canSetCanonicalAlias) {
            canonical_alias_section = (
                <select onChange={this.onCanonicalAliasChange} defaultValue={this.state.canonicalAlias}>
                    <option value="" key="unset">{ _t('not specified') }</option>
                    {
                        Object.keys(self.state.domainToAliases).map(function(domain, i) {
                            return self.state.domainToAliases[domain].map(function(alias, j) {
                                return (
                                    <option value={alias} key={i + "_" + j}>
                                        { alias }
                                    </option>
                                );
                            });
                        })
                    }
                </select>
            );
        } else {
            canonical_alias_section = (
                <b>{ this.state.canonicalAlias || _t('not set') }</b>
            );
        }

        let remote_aliases_section;
        if (this.state.remoteDomains.length) {
            remote_aliases_section = (
                <div>
                    <div className="mx_RoomSettings_aliasLabel">
                        { _t("Remote addresses for this room:") }
                    </div>
                    <div className="mx_RoomSettings_aliasesTable">
                        { this.state.remoteDomains.map((domain, i) => {
                            return this.state.domainToAliases[domain].map(function(alias, j) {
                                return (
                                    <div className="mx_RoomSettings_aliasesTableRow" key={i + "_" + j}>
                                        <EditableText
                                             className="mx_RoomSettings_alias mx_RoomSettings_editable"
                                             blurToCancel={false}
                                             editable={false}
                                             initialValue={alias} />
                                    </div>
                                );
                            });
                        }) }
                    </div>
                </div>
            );
        }

        return (
            <div>
                <h3>{ _t('Addresses') }</h3>
                <div className="mx_RoomSettings_aliasLabel">
                    { _t('The main address for this room is') }: { canonical_alias_section }
                </div>
                <EditableItemList
                    className={"mx_RoomSettings_localAliases"}
                    items={this.state.domainToAliases[localDomain] || []}
                    newItem={this.state.newAlias}
                    onNewItemChanged={this.onNewAliasChanged}
                    canEdit={this.props.canSetAliases}
                    onItemAdded={this.onLocalAliasAdded}
                    onItemEdited={this.onLocalAliasChanged}
                    onItemRemoved={this.onLocalAliasDeleted}
                    itemsLabel={_t('Local addresses for this room:')}
                    noItemsLabel={_t('This room has no local addresses')}
                    placeholder={_t(
                        'New address (e.g. #foo:%(localDomain)s)', {localDomain: localDomain},
                    )}
                />

                { remote_aliases_section }

            </div>
        );
    },
});
