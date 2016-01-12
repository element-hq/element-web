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
var q = require("q");
var sdk = require('matrix-react-sdk');
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var UserSettingsStore = require('matrix-react-sdk/lib/UserSettingsStore');
var Modal = require('matrix-react-sdk/lib/Modal');

/**
 * Enum for state of a push rule as defined by the Vector UI.
 * @readonly
 * @enum {string}
 */
var PushRuleState = {
    /** The user will receive push notification for this rule */
    ON: "on",
    /** The user will receive push notification for this rule with sound and
        highlight if this is legitimate */
    STRONG: "strong",
    /** The push rule is disabled */
    OFF: "off"
};

module.exports = React.createClass({
    displayName: 'Notififications',

    phases: {
        LOADING: "LOADING", // The component is loading or sending data to the hs
        DISPLAY: "DISPLAY", // The component is ready and display data
        ERROR: "ERROR"      // There was an error
    },
    
    getInitialState: function() {
        return {
            phase: this.phases.LOADING,
            vectorPushRules: [],            // HS default push rules displayed in Vector UI
            vectorContentRules: {           // Keyword push rules displayed in Vector UI
                state: PushRuleState.ON,
                rules: []
            },
            externalContentRules: []        // Keyword push rules that have been defined outside Vector UI
        };
    },
    
    componentWillMount: function() {
        this._refreshFromServer();
    },
    
    onEnableNotificationsChange: function(event) {
        UserSettingsStore.setEnableNotifications(event.target.checked);
    },
    
    onNotifStateButtonClicked: function(event) {
        var self = this;
        var cli = MatrixClientPeg.get();
        var vectorRuleId = event.target.className.split("-")[0];
        var newPushRuleState = event.target.className.split("-")[1];
        
        if ("keywords" === vectorRuleId 
                && this.state.vectorContentRules.state !== newPushRuleState 
                && this.state.vectorContentRules.rules.length) {
            
            this.setState({
                phase: this.phases.LOADING
            });
            
            var enabled = true;
            switch (newPushRuleState) {
                case PushRuleState.OFF:
                    enabled = false;
                    break
            }
            
            // Update all rules in self.state.vectorContentRules
            var deferreds = [];
            for (var i in this.state.vectorContentRules.rules) {
                var rule = this.state.vectorContentRules.rules[i];
                
                
                if (enabled) {
                    deferreds.push(cli.addPushRule('global', rule.kind, rule.rule_id, rule));                
                }
                else {
                    deferreds.push(cli.setPushRuleEnabled('global', rule.kind, rule.rule_id, false));
                }
            }
            
            q.all(deferreds).done(function(resps) {
                self._refreshFromServer();
            }, function(error) {
                var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: "Can't update user notification settings",
                    description: error.toString()
                });
            });
        }
        else {
            var rule = this.getRule(vectorRuleId);

            // For now, we support only enabled/disabled. 
            // Translate ON, STRONG, OFF to one of the 2.
            if (rule && rule.state !== newPushRuleState) {   

                this.setState({
                    phase: this.phases.LOADING
                });

                cli.setPushRuleEnabled('global', rule.rule.kind, rule.rule.rule_id, (newPushRuleState !== PushRuleState.OFF)).done(function() {

                   self._refreshFromServer();
                });
            }
        }
    },
    
    getRule: function(vectorRuleId) {
        for (var i in this.state.vectorPushRules) {
            var rule = this.state.vectorPushRules[i];
            if (rule.vectorRuleId === vectorRuleId) {
                return rule;
            }
        }
    },

    _refreshFromServer: function() {
        var self = this;  
        MatrixClientPeg.get().getPushRules().done(function(rulesets) {
            MatrixClientPeg.get().pushRules = rulesets;

            // Get homeserver default rules expected by Vector
            var rule_categories = {
                '.m.rule.master': 'master',

                '.m.rule.contains_display_name': 'vector',
                '.m.rule.room_one_to_one': 'vector',
                '.m.rule.invite_for_me': 'vector',
                '.m.rule.member_event': 'vector',
                '.m.rule.call': 'vector',
            };

            // HS default rules
            var defaultRules = {master: [], vector: {}, additional: [], fallthrough: [], suppression: []};
            //  Content/keyword rules
            var contentRules = {on: [], on_but_disabled:[], strong: [], strong_but_disabled: [], other: []};

            for (var kind in rulesets.global) {
                for (var i = 0; i < Object.keys(rulesets.global[kind]).length; ++i) {
                    var r = rulesets.global[kind][i];
                    var cat = rule_categories[r.rule_id];
                    r.kind = kind;
                    if (r.rule_id[0] === '.') {
                        if (cat) {
                            if (cat === 'vector')
                            {
                                defaultRules.vector[r.rule_id] = r;
                            }
                            else
                            {
                                defaultRules[cat].push(r);
                            }
                        } else {
                            defaultRules.additional.push(r);
                        }
                    }
                    else if (kind === 'content') {
                        // Count tweaks to determine if it is a ON or STRONG rule
                        var tweaks = 0;
                        for (var j in r.actions) {
                            var action = r.actions[j];
                            if (action.set_tweak === 'sound' ||
                                (action.set_tweak === 'highlight' &&  action.value)) {
                                tweaks++;
                            }
                        }

                        switch (tweaks) {
                            case 0:
                                if (r.enabled) {
                                    contentRules.on.push(r);
                                }
                                else {
                                    contentRules.on_but_disabled.push(r);
                                }
                                break;
                            case 2:
                                if (r.enabled) {
                                    contentRules.strong.push(r);
                                }
                                else {
                                    contentRules.strong_but_disabled.push(r);
                                }
                                break;
                            default:
                                contentRules.other.push(r);
                                break;
                        }
                    }
                }
            }

            // Decide which content/keyword rules to display in Vector UI.
            // Vector displays a single global rule for a list of keywords
            // whereas Matrix has a push rule per keyword.
            // Vector can set the unique rule in ON, STRONG or OFF state.
            // Matrix has enabled/disabled plus a combination of (highlight, sound) tweaks.
            
            // The code below determines which set of user's content push rules can be 
            // displayed by the vector UI.
            // Push rules that does not fir, ie defined by another Matrix client, ends
            // in self.state.externalContentRules.
            // There is priority in the determination of which set will be the displayed one.
            // The set with rules that have STRONG tweaks is the first choice. Then, the ones
            // with ON tweaks (no tweaks).
            if (contentRules.strong.length) {
                self.state.vectorContentRules = {
                    state: PushRuleState.STRONG,
                    rules: contentRules.strong
                } 
               self.state.externalContentRules = [].concat(contentRules.strong_but_disabled, contentRules.on, contentRules.on_but_disabled, contentRules.other);
            }
            else if (contentRules.strong_but_disabled.length) {
                self.state.vectorContentRules = {
                    state: PushRuleState.OFF,
                    rules: contentRules.strong_but_disabled
                } 
               self.state.externalContentRules = [].concat(contentRules.on, contentRules.on_but_disabled, contentRules.other);
            }
            else if (contentRules.on.length) {
                self.state.vectorContentRules = {
                    state: PushRuleState.ON,
                    rules: contentRules.on
                }
                self.state.externalContentRules = [].concat(contentRules.on_but_disabled, contentRules.other);
            }
            else if (contentRules.on_but_disabled.length) {
                self.state.vectorContentRules = {
                    state: PushRuleState.OFF,
                    rules: contentRules.on_but_disabled
                }
                self.state.externalContentRules = contentRules.other;
            }
            else {
                self.state.externalContentRules = contentRules.other;
            }

            // Build the rules displayed by Vector UI
            self.state.vectorPushRules = [];
            var rule, state;

            // Messages containing user's display name 
            // (skip contains_user_name which is too geeky)
            rule = defaultRules.vector['.m.rule.contains_display_name'];
            state = (rule && rule.enabled) ? PushRuleState.STRONG : PushRuleState.OFF;
            self.state.vectorPushRules.push({
                "vectorRuleId": "contains_display_name",
                "description" : "Messages containing my name",
                "rule": rule,
                "state": state,
                "disabled": PushRuleState.ON
            });

            // Messages containing keywords
            // For Vector UI, this is a single global push rule but translated in Matrix,
            // it corresponds to all content push rules (stored in self.state.vectorContentRule)
            self.state.vectorPushRules.push({
                "vectorRuleId": "keywords",
                "description" : "Messages containing keywords",
                "state": self.state.vectorContentRules.state,
            });

            // Messages just sent to the user
            rule = defaultRules.vector['.m.rule.room_one_to_one'];
            state = (rule && rule.enabled) ? PushRuleState.STRONG : PushRuleState.OFF;
            self.state.vectorPushRules.push({
                "vectorRuleId": "room_one_to_one",
                "description" : "Messages just sent to me",
                "rule": rule,
                "state": state,
                "disabled": PushRuleState.ON
            });

            // Invitation for the user
            rule = defaultRules.vector['.m.rule.invite_for_me'];
            state = (rule && rule.enabled) ? PushRuleState.STRONG : PushRuleState.OFF;
            self.state.vectorPushRules.push({
                "vectorRuleId": "invite_for_me",
                "description" : "When I'm invited to a room",
                "rule": rule,
                "state": state,
                "disabled": PushRuleState.ON
            });

            // When people join or leave a room
            rule = defaultRules.vector['.m.rule.member_event'];
            state = (rule && rule.enabled) ? PushRuleState.ON : PushRuleState.OFF;
            self.state.vectorPushRules.push({
                "vectorRuleId": "member_event",
                "description" : "When people join or leave a room",
                "rule": rule,
                "state": state,
                "disabled": PushRuleState.STRONG
            });

            // Incoming call
            rule = defaultRules.vector['.m.rule.call'];
            state = (rule && rule.enabled) ? PushRuleState.STRONG : PushRuleState.OFF;
            self.state.vectorPushRules.push({
                "vectorRuleId": "call",
                "description" : "Call invitation",
                "rule": rule,
                "state": state,
                "disabled": PushRuleState.ON
            });
            
            self.setState({
                phase: self.phases.DISPLAY
            });
        });
    },

    renderNotifRulesTableRow: function(title, className, pushRuleState, disabled) {
        return (
            <tr key = {className}>
                <th>
                    {title}
                </th>

                <th>
                    <input className= {className + "-" + PushRuleState.ON}
                        type="radio"
                        checked={ pushRuleState === PushRuleState.ON }
                        disabled= { (disabled === PushRuleState.ON) ? "disabled" : false }
                        onChange={ this.onNotifStateButtonClicked } />
                </th>

                <th>
                    <input className= {className + "-" + PushRuleState.STRONG}
                        type="radio"
                        checked={ pushRuleState === PushRuleState.STRONG }
                        disabled= { (disabled === PushRuleState.STRONG) ? "disabled" : false }
                        onChange={ this.onNotifStateButtonClicked } />
                </th>

                <th>
                    <input className= {className + "-" + PushRuleState.OFF}
                        type="radio"
                        checked={ pushRuleState === PushRuleState.OFF }
                        disabled= { (disabled === PushRuleState.OFF) ? "disabled" : false }
                        onChange={ this.onNotifStateButtonClicked } />
                </th>
            </tr>
        );
    },
    
    renderNotifRulesTableRows: function() {
        var rows = [];
        for (var i in this.state.vectorPushRules) {
            var rule = this.state.vectorPushRules[i];
            rows.push(this.renderNotifRulesTableRow(rule.description, rule.vectorRuleId, rule.state, rule.disabled));
        }
        return rows;
    },

    render: function() { 
        if (this.state.phase === this.phases.LOADING) {
            var Loader = sdk.getComponent("elements.Spinner");            
            return (
                <div className="mx_UserSettings_notifTable">
                    <Loader />
                </div>
            );
        }

        // Build the list of keywords rules that have been defined outside Vector UI
        var externalKeyWords = [];
        for (var i in this.state.externalContentRules) {
            var rule = this.state.externalContentRules[i];
            externalKeyWords.push(rule.pattern);
        }
        
        if (externalKeyWords.length) {
            externalKeyWords = externalKeyWords.join(", ");
        }
        
        return (
            <div>
                <div className="mx_UserSettings_notifTable">

                    <div className="mx_UserNotifSettings_tableRow">
                        <div className="mx_UserNotifSettings_inputCell">
                            <input id="enableNotifications"
                                ref="enableNotifications"
                                type="checkbox"
                                checked={ UserSettingsStore.getEnableNotifications() }
                                onChange={ this.onEnableNotificationsChange } />
                        </div>
                        <div className="mx_UserNotifSettings_labelCell">
                            <label htmlFor="enableNotifications">
                                Enable desktop notifications
                            </label>
                        </div>
                    </div>

                    <h3>General use </h3>

                    <div className="mx_UserNotifSettings_pushRulesTableWrapper">
                        <table className="mx_UserNotifSettings_pushRulesTable">
                            <thead>
                                <tr>
                                    <th width="55%"></th>
                                    <th width="15%">Normal</th>
                                    <th width="15%">Strong</th>
                                    <th width="15%">Off</th>
                                </tr>
                            </thead>
                            <tbody>

                                { this.renderNotifRulesTableRows() }

                            </tbody>
                        </table>
                    </div>

                </div>

                <div>
                    <br/><br/>
                    Warning: Push rules on the following keywords has been defined: <br/>
                    { externalKeyWords }
                </div>

            </div>
        );
    }
});
