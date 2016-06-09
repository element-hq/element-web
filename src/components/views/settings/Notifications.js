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

'use strict';
var React = require('react');
var q = require("q");
var sdk = require('matrix-react-sdk');
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var UserSettingsStore = require('matrix-react-sdk/lib/UserSettingsStore');
var Modal = require('matrix-react-sdk/lib/Modal');

var notifications = require('../../../notifications');

// TODO: this "view" component still has far to much application logic in it,
// which should be factored out to other files.

// TODO: this component also does a lot of direct poking into this.state, which
// is VERY NAUGHTY.

var NotificationUtils = notifications.NotificationUtils;
var VectorPushRulesDefinitions = notifications.VectorPushRulesDefinitions;
var PushRuleVectorState = notifications.PushRuleVectorState;
var ContentRules = notifications.ContentRules;

/**
 * Rules that Vector used to set in order to override the actions of default rules.
 * These are used to port peoples existing overrides to match the current API.
 * These can be removed and forgotten once everyone has moved to the new client.
 */
var LEGACY_RULES = {
    "im.vector.rule.contains_display_name": ".m.rule.contains_display_name",
    "im.vector.rule.room_one_to_one": ".m.rule.room_one_to_one",
    "im.vector.rule.room_message": ".m.rule.message",
    "im.vector.rule.invite_for_me": ".m.rule.invite_for_me",
    "im.vector.rule.call": ".m.rule.call",
    "im.vector.rule.notices": ".m.rule.suppress_notices"
};

function portLegacyActions(actions) {
    var decoded = NotificationUtils.decodeActions(actions);
    if (decoded !== null) {
        return NotificationUtils.encodeActions(decoded);
    } else {
        // We don't recognise one of the actions here, so we don't try to
        // canonicalise them.
        return actions;
    }
}

module.exports = React.createClass({
    displayName: 'Notififications',

    phases: {
        LOADING: "LOADING", // The component is loading or sending data to the hs
        DISPLAY: "DISPLAY", // The component is ready and display data
        ERROR: "ERROR"      // There was an error
    },

    propTypes: {
        // The array of threepids from the JS SDK (required for email notifications)
        threepids: React.PropTypes.array.isRequired,
        // The brand string set when creating an email pusher
        brand: React.PropTypes.string,
    },

    getDefaultProps: function() {
        return {
            threepids: []
        };
    },

    getInitialState: function() {
        return {
            phase: this.phases.LOADING,
            masterPushRule: undefined,      // The master rule ('.m.rule.master')
            vectorPushRules: [],            // HS default push rules displayed in Vector UI
            vectorContentRules: {           // Keyword push rules displayed in Vector UI
                vectorState: PushRuleVectorState.ON,
                rules: []
            },
            externalPushRules: [],          // Push rules (except content rule) that have been defined outside Vector UI
            externalContentRules: []        // Keyword push rules that have been defined outside Vector UI
        };
    },

    componentWillMount: function() {
        this._refreshFromServer();
    },

    onEnableNotificationsChange: function(event) {
        var self = this;
        this.setState({
            phase: this.phases.LOADING
        });

        MatrixClientPeg.get().setPushRuleEnabled('global', self.state.masterPushRule.kind, self.state.masterPushRule.rule_id, !event.target.checked).done(function() {
           self._refreshFromServer();
        });
    },

    onEnableDesktopNotificationsChange: function(event) {
        UserSettingsStore.setEnableNotifications(event.target.checked);
    },

    onEnableEmailNotificationsChange: function(address, event) {
        var emailPusherPromise;
        if (event.target.checked) {
            var data = {}
            data['brand'] = this.props.brand || 'Vector';
            emailPusherPromise = UserSettingsStore.addEmailPusher(address, data);
        } else {
            var emailPusher = UserSettingsStore.getEmailPusher(this.state.pushers, address);
            emailPusher.kind = null;
            emailPusherPromise = MatrixClientPeg.get().setPusher(emailPusher);
        }
        emailPusherPromise.done(() => {
            this._refreshFromServer();
        }, (error) => {
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Error saving email notification preferences",
                description: "Vector was unable to save your email notification preferences.",
            });
        });
    },

    onNotifStateButtonClicked: function(event) {
        // FIXME: use .bind() rather than className metadata here surely
        var vectorRuleId = event.target.className.split("-")[0];
        var newPushRuleVectorState = event.target.className.split("-")[1];

        if ("_keywords" === vectorRuleId) {
            this._setKeywordsPushRuleVectorState(newPushRuleVectorState)
        }
        else {
            var rule = this.getRule(vectorRuleId);
            if (rule) {
                this._setPushRuleVectorState(rule, newPushRuleVectorState);
            }
        }
    },

    onKeywordsClicked: function(event) {
        var self = this;

        // Compute the keywords list to display
        var keywords = [];
        for (var i in this.state.vectorContentRules.rules) {
            var rule = this.state.vectorContentRules.rules[i];
            keywords.push(rule.pattern);
        }
        if (keywords.length) {
            // As keeping the order of per-word push rules hs side is a bit tricky to code,
            // display the keywords in alphabetical order to the user
            keywords.sort();

            keywords = keywords.join(", ");
        }
        else {
            keywords = "";
        }

        var TextInputDialog = sdk.getComponent("dialogs.TextInputDialog");
        Modal.createDialog(TextInputDialog, {
            title: "Keywords",
            description: "Enter keywords separated by a comma:",
            value: keywords,
            onFinished: function onFinished(should_leave, newValue) {

                if (should_leave && newValue !== keywords) {
                    var newKeywords = newValue.split(',');
                    for (var i in newKeywords) {
                        newKeywords[i] = newKeywords[i].trim();
                    }

                    // Remove duplicates and empty
                    newKeywords = newKeywords.reduce(function(array, keyword){
                        if (keyword !== "" && array.indexOf(keyword) < 0) {
                            array.push(keyword);
                        }
                        return array;
                    },[]);

                    self._setKeywords(newKeywords);
                }
            }
        });
    },

    getRule: function(vectorRuleId) {
        for (var i in this.state.vectorPushRules) {
            var rule = this.state.vectorPushRules[i];
            if (rule.vectorRuleId === vectorRuleId) {
                return rule;
            }
        }
    },

    _setPushRuleVectorState: function(rule, newPushRuleVectorState) {
        if (rule && rule.vectorState !== newPushRuleVectorState) {

            this.setState({
                phase: this.phases.LOADING
            });

            var self = this;
            var cli = MatrixClientPeg.get();
            var deferreds = [];
            var ruleDefinition = VectorPushRulesDefinitions[rule.vectorRuleId];

            if (rule.rule) {
                var actions = ruleDefinition.vectorStateToActions[newPushRuleVectorState];

                if (!actions) {
                    // The new state corresponds to disabling the rule.
                    deferreds.push(cli.setPushRuleEnabled('global', rule.rule.kind, rule.rule.rule_id, false));
                }
                else {
                    // The new state corresponds to enabling the rule and setting specific actions
                    deferreds.push(this._updatePushRuleActions(rule.rule, actions, true));
                }
            }

            q.all(deferreds).done(function() {
                self._refreshFromServer();
            }, function(error) {
                var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: "Can't change settings",
                    description: error.toString(),
                    onFinished: self._refreshFromServer
                });
            });
        }
    },

    _setKeywordsPushRuleVectorState: function(newPushRuleVectorState) {
        // Is there really a change?
        if (this.state.vectorContentRules.vectorState === newPushRuleVectorState
            || this.state.vectorContentRules.rules.length === 0) {
            return;
        }

        var self = this;
        var cli = MatrixClientPeg.get();

        this.setState({
            phase: this.phases.LOADING
        });

        // Update all rules in self.state.vectorContentRules
        var deferreds = [];
        for (var i in this.state.vectorContentRules.rules) {
            var rule = this.state.vectorContentRules.rules[i];

            var enabled, actions;
            switch (newPushRuleVectorState) {
                case PushRuleVectorState.ON:
                    if (rule.actions.length !== 1) {
                        actions = PushRuleVectorState.actionsFor(PushRuleVectorState.ON);
                    }

                    if (this.state.vectorContentRules.vectorState === PushRuleVectorState.OFF) {
                        enabled = true;
                    }
                    break;

                case PushRuleVectorState.LOUD:
                    if (rule.actions.length !== 3) {
                        actions = PushRuleVectorState.actionsFor(PushRuleVectorState.LOUD);
                    }

                    if (this.state.vectorContentRules.vectorState === PushRuleVectorState.OFF) {
                        enabled = true;
                    }
                    break;

                case PushRuleVectorState.OFF:
                    enabled = false;
                    break;
            }

            if (actions) {
                // Note that the workaround in _updatePushRuleActions will automatically
                // enable the rule
                deferreds.push(this._updatePushRuleActions(rule, actions, enabled));
            }
            else if (enabled != undefined) {
                deferreds.push(cli.setPushRuleEnabled('global', rule.kind, rule.rule_id, enabled));
            }
        }

        q.all(deferreds).done(function(resps) {
            self._refreshFromServer();
        }, function(error) {
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Can't update user notification settings",
                description: error.toString(),
                onFinished: self._refreshFromServer
            });
        });
    },

    _setKeywords: function(newKeywords) {
        this.setState({
            phase: this.phases.LOADING
        });

        var self = this;
        var cli = MatrixClientPeg.get();
        var removeDeferreds = [];

        // Remove per-word push rules of keywords that are no more in the list
        var vectorContentRulesPatterns = [];
        for (var i in self.state.vectorContentRules.rules) {
            var rule = self.state.vectorContentRules.rules[i];

            vectorContentRulesPatterns.push(rule.pattern);

            if (newKeywords.indexOf(rule.pattern) < 0) {
                removeDeferreds.push(cli.deletePushRule('global', rule.kind, rule.rule_id));
            }
        }

        // If the keyword is part of `externalContentRules`, remove the rule
        // before recreating it in the right Vector path
        for (var i in self.state.externalContentRules) {
            var rule = self.state.externalContentRules[i];

            if (newKeywords.indexOf(rule.pattern) >= 0) {
                removeDeferreds.push(cli.deletePushRule('global', rule.kind, rule.rule_id));
            }
        }

        var onError = function(error) {
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Can't update keywords",
                description: error.toString(),
                onFinished: self._refreshFromServer
            });
        }

        // Then, add the new ones
        q.all(removeDeferreds).done(function(resps) {
            var deferreds = [];

            var pushRuleVectorStateKind = self.state.vectorContentRules.vectorState;
            if (pushRuleVectorStateKind === PushRuleVectorState.OFF) {
                // When the current global keywords rule is OFF, we need to look at
                // the flavor of rules in 'vectorContentRules' to apply the same actions
                // when creating the new rule.
                // Thus, this new rule will join the 'vectorContentRules' set.
                if (self.state.vectorContentRules.rules.length) {
                    pushRuleVectorStateKind = PushRuleVectorState.contentRuleVectorStateKind(self.state.vectorContentRules.rules[0]);
                }
                else {
                    // ON is default
                    pushRuleVectorStateKind =  PushRuleVectorState.ON;
                }
            }

            for (var i in newKeywords) {
                var keyword = newKeywords[i];

                if (vectorContentRulesPatterns.indexOf(keyword) < 0) {
                    if (self.state.vectorContentRules.vectorState !== PushRuleVectorState.OFF) {
                        deferreds.push(cli.addPushRule
                        ('global', 'content', keyword, {
                           actions: PushRuleVectorState.actionsFor(pushRuleVectorStateKind),
                           pattern: keyword
                        }));
                    }
                    else {
                        deferreds.push(self._addDisabledPushRule('global', 'content', keyword, {
                           actions: PushRuleVectorState.actionsFor(pushRuleVectorStateKind),
                           pattern: keyword
                        }));
                    }
                }
            }

            q.all(deferreds).done(function(resps) {
                self._refreshFromServer();
            }, onError);
        }, onError);
    },

    // Create a push rule but disabled
    _addDisabledPushRule: function(scope, kind, ruleId, body) {
        var cli = MatrixClientPeg.get();
        return cli.addPushRule(scope, kind, ruleId, body).then(function() {
            return cli.setPushRuleEnabled(scope, kind, ruleId, false);
        });
    },

    // Check if any legacy im.vector rules need to be ported to the new API
    // for overriding the actions of default rules.
    _portRulesToNewAPI: function(rulesets) {
        var self = this;
        var needsUpdate = [];
        var cli = MatrixClientPeg.get();

        for (var kind in rulesets.global) {
            var ruleset = rulesets.global[kind];
            for (var i = 0; i < ruleset.length; ++i) {
                var rule = ruleset[i];
                if (rule.rule_id in LEGACY_RULES) {
                    console.log("Porting legacy rule", rule);
                    needsUpdate.push( function(kind, rule) {
                        return cli.setPushRuleActions(
                            'global', kind, LEGACY_RULES[rule.rule_id], portLegacyActions(rule.actions)
                        ).then( function() {
                            return cli.deletePushRule('global', kind, rule.rule_id);
                        })
                    }(kind, rule));
                }
            }
        }

        if (needsUpdate.length > 0) {
            // If some of the rules need to be ported then wait for the porting
            // to happen and then fetch the rules again.
            return q.allSettled(needsUpdate).then( function() {
                return cli.getPushRules();
            });
        } else {
            // Otherwise return the rules that we already have.
            return rulesets;
        }
    },

    _refreshFromServer: function() {
        var self = this;
        var pushRulesPromise = MatrixClientPeg.get().getPushRules().then(self._portRulesToNewAPI).then(function(rulesets) {
            //console.log("resolving pushRulesPromise");

            /// XXX seriously? wtf is this?
            MatrixClientPeg.get().pushRules = rulesets;

            // Get homeserver default rules and triage them by categories
            var rule_categories = {
                // The master rule (all notifications disabling)
                '.m.rule.master': 'master',

                // The default push rules displayed by Vector UI
                // XXX: .m.rule.contains_user_name is not managed (not a fancy rule for Vector?)
                '.m.rule.contains_display_name': 'vector',
                '.m.rule.room_one_to_one': 'vector',
                '.m.rule.message': 'vector',
                '.m.rule.invite_for_me': 'vector',
                //'.m.rule.member_event': 'vector',
                '.m.rule.call': 'vector',
                '.m.rule.suppress_notices': 'vector'

                // Others go to others
            };

            // HS default rules
            var defaultRules = {master: [], vector: {}, others: []};

            for (var kind in rulesets.global) {
                for (var i = 0; i < Object.keys(rulesets.global[kind]).length; ++i) {
                    var r = rulesets.global[kind][i];
                    var cat = rule_categories[r.rule_id];
                    r.kind = kind;

                    if (r.rule_id[0] === '.') {
                        if (cat === 'vector') {
                            defaultRules.vector[r.rule_id] = r;
                        }
                        else if (cat === 'master') {
                            defaultRules.master.push(r);
                        }
                        else {
                            defaultRules['others'].push(r);
                        }
                    }
                }
            }

            // Get the master rule if any defined by the hs
            if (defaultRules.master.length > 0) {
                self.state.masterPushRule = defaultRules.master[0];
            }

            // parse the keyword rules into our state
            var contentRules = ContentRules.parseContentRules(rulesets);
            self.state.vectorContentRules = {
                vectorState: contentRules.vectorState,
                rules: contentRules.rules,
            };
            self.state.externalContentRules = contentRules.externalRules;

            // Build the rules displayed in the Vector UI matrix table
            self.state.vectorPushRules = [];
            self.state.externalPushRules = [];

            var vectorRuleIds = [
                '.m.rule.contains_display_name',
                '_keywords',
                '.m.rule.room_one_to_one',
                '.m.rule.message',
                '.m.rule.invite_for_me',
                //'im.vector.rule.member_event',
                '.m.rule.call',
                '.m.rule.suppress_notices'
            ];
            for (var i in vectorRuleIds) {
                var vectorRuleId = vectorRuleIds[i];

                if (vectorRuleId === '_keywords') {
                    // keywords needs a special handling
                    // For Vector UI, this is a single global push rule but translated in Matrix,
                    // it corresponds to all content push rules (stored in self.state.vectorContentRule)
                    self.state.vectorPushRules.push({
                        "vectorRuleId": "_keywords",
                        "description" : (<span>Messages containing <span className="mx_UserNotifSettings_keywords" onClick={ self.onKeywordsClicked }>keywords</span></span>),
                        "vectorState": self.state.vectorContentRules.vectorState
                    });
                }
                else {
                    var ruleDefinition = VectorPushRulesDefinitions[vectorRuleId];
                    var rule = defaultRules.vector[vectorRuleId];

                    var vectorState = ruleDefinition.ruleToVectorState(rule);

                    //console.log("Refreshing vectorPushRules for " + vectorRuleId +", "+ ruleDefinition.description +", " + rule +", " + vectorState);

                    self.state.vectorPushRules.push({
                        "vectorRuleId": vectorRuleId,
                        "description" : ruleDefinition.description,
                        "rule": rule,
                        "vectorState": vectorState,
                    });

                    // if there was a rule which we couldn't parse, add it to the external list
                    if (rule && !vectorState) {
                        rule.description = ruleDefinition.description;
                        self.state.externalPushRules.push(rule);
                    }
                }
            }

            // Build the rules not managed by Vector UI
            var otherRulesDescriptions = {
                '.m.rule.message': "Notify for all other messages/rooms",
                '.m.rule.fallback': "Notify me for anything else"
            };

            for (var i in defaultRules.others) {
                var rule = defaultRules.others[i];
                var ruleDescription = otherRulesDescriptions[rule.rule_id];

                // Show enabled default rules that was modified by the user
                if (ruleDescription && rule.enabled && !rule.default) {
                    rule.description = ruleDescription;
                    self.state.externalPushRules.push(rule);
                }
            }
        });

        var pushersPromise = MatrixClientPeg.get().getPushers().then(function(resp) {
            //console.log("resolving pushersPromise");
            self.setState({pushers: resp.pushers});
        });

        q.all([pushRulesPromise, pushersPromise]).then(function() {
            self.setState({
                phase: self.phases.DISPLAY
            });
        }, function(error) {
            self.setState({
                phase: self.phases.ERROR
            });
        }).finally(() => {
            // actually explicitly update our state  having been deep-manipulating it
            self.setState({
                masterPushRule: self.state.masterPushRule,
                vectorContentRules: self.state.vectorContentRules,
                vectorPushRules: self.state.vectorPushRules,
                externalContentRules: self.state.externalContentRules,
                externalPushRules: self.state.externalPushRules,
            });
        }).done();
    },

    _updatePushRuleActions: function(rule, actions, enabled) {
        var cli = MatrixClientPeg.get();

        return cli.setPushRuleActions(
            'global', rule.kind, rule.rule_id, actions
        ).then( function() {
            // Then, if requested, enabled or disabled the rule
            if (undefined != enabled) {
                return cli.setPushRuleEnabled(
                    'global', rule.kind, rule.rule_id, enabled
                );
            }
        });
    },

    renderNotifRulesTableRow: function(title, className, pushRuleVectorState) {
        return (
            <tr key={ className }>
                <th>
                    {title}
                </th>

                <th>
                    <input className= {className + "-" + PushRuleVectorState.OFF}
                        type="radio"
                        checked={ pushRuleVectorState === PushRuleVectorState.OFF }
                        onChange={ this.onNotifStateButtonClicked } />
                </th>

                <th>
                    <input className= {className + "-" + PushRuleVectorState.ON}
                        type="radio"
                        checked={ pushRuleVectorState === PushRuleVectorState.ON }
                        onChange={ this.onNotifStateButtonClicked } />
                </th>

                <th>
                    <input className= {className + "-" + PushRuleVectorState.LOUD}
                        type="radio"
                        checked={ pushRuleVectorState === PushRuleVectorState.LOUD }
                        onChange={ this.onNotifStateButtonClicked } />
                </th>
            </tr>
        );
    },

    renderNotifRulesTableRows: function() {
        var rows = [];
        for (var i in this.state.vectorPushRules) {
            var rule = this.state.vectorPushRules[i];
            //console.log("rendering: " + rule.description + ", " + rule.vectorRuleId + ", " + rule.vectorState);
            rows.push(this.renderNotifRulesTableRow(rule.description, rule.vectorRuleId, rule.vectorState));
        }
        return rows;
    },

    emailNotificationsRow: function(address, label) {
        return (<div className="mx_UserNotifSettings_tableRow">
            <div className="mx_UserNotifSettings_inputCell">
                <input id="enableEmailNotifications_{address}"
                    ref="enableEmailNotifications_{address}"
                    type="checkbox"
                    checked={ UserSettingsStore.hasEmailPusher(this.state.pushers, address) }
                    onChange={ this.onEnableEmailNotificationsChange.bind(this, address) }
                />
            </div>
            <div className="mx_UserNotifSettings_labelCell">
                <label htmlFor="enableEmailNotifications_{address}">
                    {label}
                </label>
            </div>
        </div>);
    },

    render: function() {
        var self = this;

        var spinner;
        if (this.state.phase === this.phases.LOADING) {
            var Loader = sdk.getComponent("elements.Spinner");
            spinner = <Loader />;
        }

        if (this.state.masterPushRule) {
            var masterPushRuleDiv = (
                <div className="mx_UserNotifSettings_tableRow">
                        <div className="mx_UserNotifSettings_inputCell">
                            <input id="enableNotifications"
                                ref="enableNotifications"
                                type="checkbox"
                                checked={ !this.state.masterPushRule.enabled }
                                onChange={ this.onEnableNotificationsChange } />
                        </div>
                        <div className="mx_UserNotifSettings_labelCell">
                            <label htmlFor="enableNotifications">
                                Enable notifications for this account
                            </label>
                        </div>
                    </div>
            );
        }

        // When enabled, the master rule inhibits all existing rules
        // So do not show all notification settings
        if (this.state.masterPushRule && this.state.masterPushRule.enabled) {
            return (
                <div>
                    {masterPushRuleDiv}

                    <div className="mx_UserSettings_notifTable">
                        All notifications are currently disabled for all targets.
                    </div>
                </div>
            );
        }

        var emailNotificationsRow;
        if (this.props.threepids.filter(function(tp) {
                if (tp.medium == "email") {
                    return true;
                }
            }).length == 0) {
            emailNotificationsRow = <div>
                Add an email address above to configure email notifications
            </div>;
        } else {
            // This only supports the first email address in your profile for now
            emailNotificationsRow = this.emailNotificationsRow(
                this.props.threepids[0].address,
                "Enable email notifications ("+this.props.threepids[0].address+")"
            );
        }

        // Build external push rules
        var externalRules = [];
        for (var i in this.state.externalPushRules) {
            var rule = this.state.externalPushRules[i];
            externalRules.push(<li>{ rule.description }</li>);
        }

        // Show keywords not displayed by the vector UI as a single external push rule
        var externalKeyWords = [];
        for (var i in this.state.externalContentRules) {
            var rule = this.state.externalContentRules[i];
            externalKeyWords.push(rule.pattern);
        }
        if (externalKeyWords.length) {
            externalKeyWords = externalKeyWords.join(", ");
            externalRules.push(<li>Notifications on the following keywords follow rules which can’t be displayed here: { externalKeyWords }</li>);
        }

        var devicesSection;
        if (this.state.pushers === undefined) {
            devicesSection = <div className="error">Unable to fetch notification target list</div>
        } else if (this.state.pushers.length == 0) {
            devicesSection = null;
        } else {
            // TODO: It would be great to be able to delete pushers from here too,
            // and this wouldn't be hard to add.
            var rows = [];
            for (var i = 0; i < this.state.pushers.length; ++i) {
                rows.push(<tr key={ i }>
                    <td>{this.state.pushers[i].app_display_name}</td>
                    <td>{this.state.pushers[i].device_display_name}</td>
                </tr>);
            }
            devicesSection = (<table className="mx_UserSettings_devicesTable">
                <tbody>
                    {rows}
                </tbody>
            </table>);
        }
        if (devicesSection) {
            devicesSection = (<div>
                <h3>Notification targets</h3>
                { devicesSection }
            </div>);
        }

        var advancedSettings;
        if (externalRules.length) {
            advancedSettings = (
                <div>
                    <h3>Advanced notifications settings</h3>
                    There are advanced notifications which are not shown here.<br/>
                    You might have configured them in another client than Vector. You cannot tune them in Vector but they still apply.
                    <ul>
                        { externalRules }
                    </ul>
                </div>
            );
        }

        return (
            <div>

                {masterPushRuleDiv}

                <div className="mx_UserSettings_notifTable">

                    { spinner }

                    <div className="mx_UserNotifSettings_tableRow">
                        <div className="mx_UserNotifSettings_inputCell">
                            <input id="enableDesktopNotifications"
                                ref="enableDesktopNotifications"
                                type="checkbox"
                                checked={ UserSettingsStore.getEnableNotifications() }
                                onChange={ this.onEnableDesktopNotificationsChange } />
                        </div>
                        <div className="mx_UserNotifSettings_labelCell">
                            <label htmlFor="enableDesktopNotifications">
                                Enable desktop notifications
                            </label>
                        </div>
                    </div>

                    <div className="mx_UserNotifSettings_tableRow">
                        <div className="mx_UserNotifSettings_inputCell">
                            <input id="enableDesktopAudioNotifications"
                                ref="enableDesktopAudioNotifications"
                                type="checkbox"
                                checked={ UserSettingsStore.getEnableAudioNotifications() }
                                onChange={ (e) => {
                                    UserSettingsStore.setEnableAudioNotifications(e.target.checked);
                                    this.forceUpdate();
                                }} />
                        </div>
                        <div className="mx_UserNotifSettings_labelCell">
                            <label htmlFor="enableDesktopAudioNotifications">
                                Enable audible notifications in web client
                            </label>
                        </div>
                    </div>

                    { emailNotificationsRow }

                    <div className="mx_UserNotifSettings_pushRulesTableWrapper">
                        <table className="mx_UserNotifSettings_pushRulesTable">
                            <thead>
                                <tr>
                                    <th width="55%"></th>
                                    <th width="15%">Off</th>
                                    <th width="15%">On</th>
                                    <th width="15%">Highlight<br/>&amp; sound</th>
                                </tr>
                            </thead>
                            <tbody>

                                { this.renderNotifRulesTableRows() }

                            </tbody>
                        </table>
                    </div>

                    { advancedSettings }

                    { devicesSection }

                </div>

            </div>
        );
    }
});
