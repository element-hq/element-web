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
var sdk = require('matrix-react-sdk');
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var UserSettingsStore = require('matrix-react-sdk/lib/UserSettingsStore');

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
            vectorPushRules: []
        };
    },
    
    componentWillMount: function() {
        this._refreshFromServer();
    },
    
    onEnableNotificationsChange: function(event) {
        UserSettingsStore.setEnableNotifications(event.target.checked);
    },
    
    onNotifStateButtonClicked: function(event) {
        var vectorRuleId = event.target.className.split("-")[0];
        var newPushRuleState = event.target.className.split("-")[1];     
        
        var rule = this.getRule(vectorRuleId);

        // For now, we support only enabled/disabled. 
        // Translate ON, STRONG, OFF to one of the 2.
        if (rule && rule.state !== newPushRuleState) {   
            
            this.setState({
                phase: this.phases.LOADING
            });
            
            var self = this;
            MatrixClientPeg.get().setPushRuleEnabled('global', rule.rule.kind, rule.rule.rule_id, (newPushRuleState !== PushRuleState.OFF)).done(function() {
               
               self._refreshFromServer();
               self.forceUpdate();
            });
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

            var defaultRules = {master: [], vector: {}, additional: [], fallthrough: [], suppression: []};
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
                }
            }

            // Build the rules displayed by Vector UI
            self.state.vectorPushRules = [];
            var rule, state;

            rule = defaultRules.vector['.m.rule.contains_display_name'];
            state = (rule && rule.enabled) ? PushRuleState.STRONG : PushRuleState.OFF;
            self.state.vectorPushRules.push({
                "vectorRuleId": "contains_display_name",
                "description" : "Messages containing my name",
                "rule": rule,
                "state": state,
                "disabled": PushRuleState.ON
            });

            // TODO: Merge contains_user_name

            // TODO: Add "Messages containing keywords"

            rule = defaultRules.vector['.m.rule.room_one_to_one'];
            state = (rule && rule.enabled) ? PushRuleState.STRONG : PushRuleState.OFF;
            self.state.vectorPushRules.push({
                "vectorRuleId": "room_one_to_one",
                "description" : "Messages just sent to me",
                "rule": rule,
                "state": state,
                "disabled": PushRuleState.ON
            });

            rule = defaultRules.vector['.m.rule.invite_for_me'];
            state = (rule && rule.enabled) ? PushRuleState.STRONG : PushRuleState.OFF;
            self.state.vectorPushRules.push({
                "vectorRuleId": "invite_for_me",
                "description" : "When I'm invited to a room",
                "rule": rule,
                "state": state,
                "disabled": PushRuleState.ON
            });

            rule = defaultRules.vector['.m.rule.member_event'];
            state = (rule && rule.enabled) ? PushRuleState.ON : PushRuleState.OFF;
            self.state.vectorPushRules.push({
                "vectorRuleId": "member_event",
                "description" : "When people join or leave a room",
                "rule": rule,
                "state": state,
                "disabled": PushRuleState.STRONG
            });

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
            
            self.forceUpdate();
        });
    },

    renderNotifRulesTableRow: function(title, className, pushRuleState, disabled) {
        return (
            <tr key = {className}>
                <th class="">{title}</th>

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
        
        return (
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
        );
    }
});
