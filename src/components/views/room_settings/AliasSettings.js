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

var q = require("q");
var React = require('react');
var ObjectUtils = require("../../../ObjectUtils");
var MatrixClientPeg = require('../../../MatrixClientPeg');
var sdk = require("../../../index");
var Modal = require("../../../Modal");

module.exports = React.createClass({
    displayName: 'AliasSettings',

    propTypes: {
        roomId: React.PropTypes.string.isRequired,
        canSetCanonicalAlias: React.PropTypes.bool.isRequired,
        canSetAliases: React.PropTypes.bool.isRequired,
        aliasEvents: React.PropTypes.array, // [MatrixEvent]
        canonicalAliasEvent: React.PropTypes.object // MatrixEvent
    },

    getDefaultProps: function() {
        return {
            canSetAliases: false,
            canSetCanonicalAlias: false,
            aliasEvents: []
        };
    },

    getInitialState: function() {
        return this.recalculateState(this.props.aliasEvents, this.props.canonicalAliasEvent);
    },

    recalculateState: function(aliasEvents, canonicalAliasEvent) {
        aliasEvents = aliasEvents || [];

        var state = {
            domainToAliases: {}, // { domain.com => [#alias1:domain.com, #alias2:domain.com] }
            remoteDomains: [], // [ domain.com, foobar.com ]
            canonicalAlias: null // #canonical:domain.com
        };
        var localDomain = MatrixClientPeg.get().getDomain();

        state.domainToAliases = this.aliasEventsToDictionary(aliasEvents);

        state.remoteDomains = Object.keys(state.domainToAliases).filter((alias) => {
            return alias !== localDomain;
        });

        if (canonicalAliasEvent) {
            state.canonicalAlias = canonicalAliasEvent.getContent().alias;
        }

        return state;
    },

    saveSettings: function() {
        var promises = [];

        // save new aliases for m.room.aliases
        var aliasOperations = this.getAliasOperations();
        for (var i = 0; i < aliasOperations.length; i++) {
            var alias_operation = aliasOperations[i];
            console.log("alias %s %s", alias_operation.place, alias_operation.val);
            switch (alias_operation.place) {
                case 'add':
                    promises.push(
                        MatrixClientPeg.get().createAlias(
                            alias_operation.val, this.props.roomId
                        )
                    );
                    break;
                case 'del':
                    promises.push(
                        MatrixClientPeg.get().deleteAlias(
                            alias_operation.val
                        )
                    );
                    break;
                default:
                    console.log("Unknown alias operation, ignoring: " + alias_operation.place);
            }
        }


        // save new canonical alias
        var oldCanonicalAlias = null;
        if (this.props.canonicalAliasEvent) {
            oldCanonicalAlias = this.props.canonicalAliasEvent.getContent().alias;
        }
        if (oldCanonicalAlias !== this.state.canonicalAlias) {
            console.log("AliasSettings: Updating canonical alias");
            promises = [q.all(promises).then(
                MatrixClientPeg.get().sendStateEvent(
                    this.props.roomId, "m.room.canonical_alias", {
                        alias: this.state.canonicalAlias
                    }, ""
                )
            )];
        }

        return promises;
    },

    aliasEventsToDictionary: function(aliasEvents) { // m.room.alias events
        var dict = {};
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
        var oldAliases = this.aliasEventsToDictionary(this.props.aliasEvents);
        return ObjectUtils.getKeyValueArrayDiffs(oldAliases, this.state.domainToAliases);
    },

    onAliasAdded: function(alias) {
        if (!alias || alias.length === 0) return; // ignore attempts to create blank aliases

        if (this.isAliasValid(alias)) {
            // add this alias to the domain to aliases dict
            var domain = alias.replace(/^.*?:/, '');
            // XXX: do we need to deep copy aliases before editing it?
            this.state.domainToAliases[domain] = this.state.domainToAliases[domain] || [];
            this.state.domainToAliases[domain].push(alias);
            this.setState({
                domainToAliases: this.state.domainToAliases
            });

            // reset the add field
            this.refs.add_alias.setValue(''); // FIXME
        }
        else {
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Invalid alias format",
                description: "'" + alias + "' is not a valid format for an alias",
            });
        }
    },

    onAliasChanged: function(domain, index, alias) {
        if (alias === "") return; // hit the delete button to delete please
        var oldAlias;
        if (this.isAliasValid(alias)) {
            oldAlias = this.state.domainToAliases[domain][index];
            this.state.domainToAliases[domain][index] = alias;
        }
        else {
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Invalid address format",
                description: "'" + alias + "' is not a valid format for an address",
            });
        }
    },

    onAliasDeleted: function(domain, index) {
        // It's a bit naughty to directly manipulate this.state, and React would
        // normally whine at you, but it can't see us doing the splice.  Given we
        // promptly setState anyway, it's just about acceptable.  The alternative
        // would be to arbitrarily deepcopy to a temp variable and then setState
        // that, but why bother when we can cut this corner.
        var alias = this.state.domainToAliases[domain].splice(index, 1);
        this.setState({
            domainToAliases: this.state.domainToAliases
        });
    },

    onCanonicalAliasChange: function(event) {
        this.setState({
            canonicalAlias: event.target.value
        });
    },

    render: function() {
        var self = this;
        var EditableText = sdk.getComponent("elements.EditableText");
        var localDomain = MatrixClientPeg.get().getDomain();

        var canonical_alias_section;
        if (this.props.canSetCanonicalAlias) {
            canonical_alias_section = (
                <select onChange={this.onCanonicalAliasChange} defaultValue={ this.state.canonicalAlias }>
                    <option value="" key="unset">not specified</option>
                    {
                        Object.keys(self.state.domainToAliases).map(function(domain, i) {
                            return self.state.domainToAliases[domain].map(function(alias, j) {
                                return (
                                    <option value={ alias } key={ i + "_" + j }>
                                        { alias }
                                    </option>
                                );
                            });
                        })
                    }
                </select>
            );
        }
        else {
            canonical_alias_section = (
                <b>{ this.state.canonicalAlias || "not set" }</b>
            );
        }

        var remote_aliases_section;
        if (this.state.remoteDomains.length) {
            remote_aliases_section = (
                <div>
                    <div className="mx_RoomSettings_aliasLabel">
                        Remote addresses for this room:
                    </div>
                    <div className="mx_RoomSettings_aliasesTable">
                        { this.state.remoteDomains.map((domain, i) => {
                            return this.state.domainToAliases[domain].map(function(alias, j) {
                                return (
                                    <div className="mx_RoomSettings_aliasesTableRow" key={ i + "_" + j }>
                                        <EditableText
                                             className="mx_RoomSettings_alias mx_RoomSettings_editable"
                                             blurToCancel={ false }
                                             editable={ false }
                                             initialValue={ alias } />
                                    </div>
                                );
                            });
                        })}
                    </div>
                </div>
            );
        }

        return (
            <div>
                <h3>Addresses</h3>
                <div className="mx_RoomSettings_aliasLabel">
                    The main address for this room is: { canonical_alias_section }
                </div>
                <div className="mx_RoomSettings_aliasLabel">
                    { (this.state.domainToAliases[localDomain] &&
                        this.state.domainToAliases[localDomain].length > 0)
                      ? "Local addresses for this room:"
                      : "This room has no local addresses" }
                </div>
                <div className="mx_RoomSettings_aliasesTable">
                    { (this.state.domainToAliases[localDomain] || []).map((alias, i) => {
                        var deleteButton;
                        if (this.props.canSetAliases) {
                            deleteButton = (
                                <img src="img/cancel-small.svg" width="14" height="14"
                                    alt="Delete" onClick={ self.onAliasDeleted.bind(self, localDomain, i) } />
                            );
                        }
                        return (
                            <div className="mx_RoomSettings_aliasesTableRow" key={ i }>
                                <EditableText
                                    className="mx_RoomSettings_alias mx_RoomSettings_editable"
                                    placeholderClassName="mx_RoomSettings_aliasPlaceholder"
                                    placeholder={ "New address (e.g. #foo:" + localDomain + ")" }
                                    blurToCancel={ false }
                                    onValueChanged={ self.onAliasChanged.bind(self, localDomain, i) }
                                    editable={ self.props.canSetAliases }
                                    initialValue={ alias } />
                                <div className="mx_RoomSettings_deleteAlias mx_filterFlipColor">
                                     { deleteButton }
                                </div>
                            </div>
                        );
                    })}

                    { this.props.canSetAliases ?
                        <div className="mx_RoomSettings_aliasesTableRow" key="new">
                            <EditableText
                                ref="add_alias"
                                className="mx_RoomSettings_alias mx_RoomSettings_editable"
                                placeholderClassName="mx_RoomSettings_aliasPlaceholder"
                                placeholder={ "New address (e.g. #foo:" + localDomain + ")" }
                                blurToCancel={ false }
                                onValueChanged={ self.onAliasAdded } />
                            <div className="mx_RoomSettings_addAlias mx_filterFlipColor">
                                 <img src="img/plus.svg" width="14" height="14" alt="Add"
                                      onClick={ self.onAliasAdded.bind(self, undefined) }/>
                            </div>
                        </div> : ""
                    }
                </div>

                { remote_aliases_section }

            </div>
        );
    }
});
