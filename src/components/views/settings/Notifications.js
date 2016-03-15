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

/**
 * Enum for state of a push rule as defined by the Vector UI.
 * @readonly
 * @enum {string}
 */
var PushRuleVectorState = {
    /** The user will receive push notification for this rule */
    ON: "on",
    /** The user will receive push notification for this rule with sound and
        highlight if this is legitimate */
    LOUD: "loud",
    /** The push rule is disabled */
    OFF: "off"
};

// Encodes a dictionary of {
//   "notify": true/false,
//   "sound": string or undefined,
//   "highlight: true/false,
// }
// to a list of push actions.
function encodeActions(action) {
    var notify = action.notify;
    var sound = action.sound;
    var highlight = action.highlight;
    if (notify) {
        var actions = ["notify"];
        if (sound) {
            actions.push({"set_tweak": "sound", "value": sound});
        }
        if (highlight) {
            actions.push({"set_tweak": "highlight"});
        } else {
            actions.push({"set_tweak": "highlight", "value": false});
        }
        return actions;
    } else {
        return ["dont_notify"];
    }
}

// Decode a list of actions to a dictionary of {
//   "notify": true/false,
//   "sound": string or undefined,
//   "highlight: true/false,
// }
// If the actions couldn't be decoded then returns null.
function decodeActions(actions) {
    var notify = false;
    var sound = null;
    var highlight = false;

    for (var i = 0; i < actions.length; ++i) {
        var action = actions[i];
        if (action === "notify") {
            notify = true;
        } else if (action === "dont_notify") {
            notify = false;
        } else if (typeof action === 'object') {
            if (action.set_tweak === "sound") {
                sound = action.value
            } else if (action.set_tweak === "highlight") {
                highlight = action.value;
            } else {
                // We don't understand this kind of tweak, so give up.
                return null;
            }
        } else {
            // We don't understand this kind of action, so give up.
            return null;
        }
    }

    if (highlight === undefined) {
        // If a highlight tweak is missing a value then it defaults to true.
        highlight = true;
    }

    var result = {notify: notify, highlight: highlight};
    if (sound !== null) {
        result.sound = sound;
    }
    return result;
}

var ACTION_NOTIFY = encodeActions({notify: true});
var ACTION_NOTIFY_DEFAULT_SOUND = encodeActions({notify: true, sound: "default"});
var ACTION_NOTIFY_RING_SOUND = encodeActions({notify: true, sound: "ring"});
var ACTION_HIGHLIGHT_DEFAULT_SOUND = encodeActions({notify: true, sound: "default", highlight: true});
var ACTION_DONT_NOTIFY = encodeActions({notify: false});
var ACTION_DISABLED = null;


/**
 * The descriptions of rules managed by the Vector UI.
 */
var VectorPushRulesDefinitions = {

     // Messages containing user's display name 
     // (skip contains_user_name which is too geeky)
     ".m.rule.contains_display_name": {
        kind: "underride",
        description: "Messages containing my name",
        vectorStateToActions: { // The actions for each vector state, or null to disable the rule.
            on: ACTION_NOTIFY,
            loud: ACTION_HIGHLIGHT_DEFAULT_SOUND,
            off: ACTION_DISABLED
        }
    },

    // Messages just sent to the user in a 1:1 room
    ".m.rule.room_one_to_one": {
        kind: "underride",
        description: "Messages in one-to-one chats",
        vectorStateToActions: {
            on: ACTION_NOTIFY,
            loud: ACTION_NOTIFY_DEFAULT_SOUND,
            off: ACTION_DONT_NOTIFY
        }
    },

    // Messages just sent to a group chat room
    // 1:1 room messages are catched by the .m.rule.room_one_to_one rule if any defined
    // By opposition, all other room messages are from group chat rooms.
    ".m.rule.message": {
        kind: "underride",
        description: "Messages in group chats",
        vectorStateToActions: {
            on: ACTION_NOTIFY,
            loud: ACTION_NOTIFY_DEFAULT_SOUND,
            off: ACTION_DONT_NOTIFY
        }
    },

    // Invitation for the user
    ".m.rule.invite_for_me": {
        kind: "underride",
        description: "When I'm invited to a room",
        vectorStateToActions: {
            on: ACTION_NOTIFY,
            loud: ACTION_NOTIFY_DEFAULT_SOUND,
            off: ACTION_DISABLED
        }
    },

    // Incoming call
    ".m.rule.call": {
        kind: "underride",
        description: "Call invitation",
        vectorStateToActions: {
            on: ACTION_NOTIFY,
            loud: ACTION_NOTIFY_RING_SOUND,
            off: ACTION_DISABLED
        }
    },

    // Notifications from bots
    ".m.rule.suppress_notices": {
        kind: "override",
        description: "Messages sent by bot",
        vectorStateToActions: {
            // .m.rule.suppress_notices is a "negative" rule, we have to invert its enabled value for vector UI
            on: ACTION_DISABLED,
            loud: ACTION_NOTIFY_DEFAULT_SOUND,
            off: ACTION_DONT_NOTIFY,
        }
    }
};

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
    var decoded = decodeActions(actions);
    if (decoded !== null) {
        return encodeActions(decoded);
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
    
    onNotifStateButtonClicked: function(event) {
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
    
    _actionsFor: function(pushRuleVectorState) {
        if (pushRuleVectorState === PushRuleVectorState.ON) {
            return ACTION_NOTIFY;
        }
        else if (pushRuleVectorState === PushRuleVectorState.LOUD) {
            return ACTION_HIGHLIGHT_DEFAULT_SOUND;
        }
    },
    
    // Determine whether a content rule is in the PushRuleVectorState.ON category or in PushRuleVectorState.LOUD
    // regardless of its enabled state. Returns undefined if it does not match these categories.
    _contentRuleVectorStateKind: function(rule) {
        var stateKind;
 
        // Count tweaks to determine if it is a ON or LOUD rule
        var tweaks = 0;
        for (var j in rule.actions) {
            var action = rule.actions[j];
            if (action.set_tweak === 'sound' ||
                (action.set_tweak === 'highlight' &&  action.value)) {
                tweaks++;
            }
        }
        switch (tweaks) {
            case 0:
                stateKind = PushRuleVectorState.ON;
                break;
            case 2:
                stateKind = PushRuleVectorState.LOUD;
                break;
        }
        return stateKind;
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

                if (actions === ACTION_DISABLED) {
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
                        actions = this._actionsFor(PushRuleVectorState.ON);
                    }

                    if (this.state.vectorContentRules.vectorState === PushRuleVectorState.OFF) {
                        enabled = true;
                    }
                    break;

                case PushRuleVectorState.LOUD:
                    if (rule.actions.length !== 3) {
                        actions = this._actionsFor(PushRuleVectorState.LOUD);
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
                    pushRuleVectorStateKind = self._contentRuleVectorStateKind(self.state.vectorContentRules.rules[0]);
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
                           actions: self._actionsFor(pushRuleVectorStateKind),
                           pattern: keyword
                        }));
                    }
                    else {
                        deferreds.push(self._addDisabledPushRule('global', 'content', keyword, {
                           actions: self._actionsFor(pushRuleVectorStateKind),
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
        var deferred = q.defer();

        cli.addPushRule(scope, kind, ruleId, body).done(function() {
            cli.setPushRuleEnabled(scope, kind, ruleId, false).done(function() {
                deferred.resolve();
            }, function(err) {
                deferred.reject(err);
            });
        }, function(err) {
            deferred.reject(err);
        });

        return deferred.promise;
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
        MatrixClientPeg.get().getPushRules().then(self._portRulesToNewAPI).done(function(rulesets) {
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
            //  Content/keyword rules
            var contentRules = {on: [], on_but_disabled:[], loud: [], loud_but_disabled: [], other: []};

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
                    else if (kind === 'content') {
                        switch (self._contentRuleVectorStateKind(r)) {
                            case PushRuleVectorState.ON:
                                if (r.enabled) {
                                    contentRules.on.push(r);
                                }
                                else {
                                    contentRules.on_but_disabled.push(r);
                                }
                                break;
                            case PushRuleVectorState.LOUD:
                                if (r.enabled) {
                                    contentRules.loud.push(r);
                                }
                                else {
                                    contentRules.loud_but_disabled.push(r);
                                }
                                break;
                            default:
                                contentRules.other.push(r);
                                break;
                        }
                    }
                }
            }

            // Decide which content rules to display in Vector UI.
            // Vector displays a single global rule for a list of keywords
            // whereas Matrix has a push rule per keyword.
            // Vector can set the unique rule in ON, LOUD or OFF state.
            // Matrix has enabled/disabled plus a combination of (highlight, sound) tweaks.
            
            // The code below determines which set of user's content push rules can be 
            // displayed by the vector UI.
            // Push rules that does not fit, ie defined by another Matrix client, ends
            // in self.state.externalContentRules.
            // There is priority in the determination of which set will be the displayed one.
            // The set with rules that have LOUD tweaks is the first choice. Then, the ones
            // with ON tweaks (no tweaks).
            if (contentRules.loud.length) {
                self.state.vectorContentRules = {
                    vectorState: PushRuleVectorState.LOUD,
                    rules: contentRules.loud
                } 
               self.state.externalContentRules = [].concat(contentRules.loud_but_disabled, contentRules.on, contentRules.on_but_disabled, contentRules.other);
            }
            else if (contentRules.loud_but_disabled.length) {
                self.state.vectorContentRules = {
                    vectorState: PushRuleVectorState.OFF,
                    rules: contentRules.loud_but_disabled
                } 
               self.state.externalContentRules = [].concat(contentRules.on, contentRules.on_but_disabled, contentRules.other);
            }
            else if (contentRules.on.length) {
                self.state.vectorContentRules = {
                    vectorState: PushRuleVectorState.ON,
                    rules: contentRules.on
                }
                self.state.externalContentRules = [].concat(contentRules.on_but_disabled, contentRules.other);
            }
            else if (contentRules.on_but_disabled.length) {
                self.state.vectorContentRules = {
                    vectorState: PushRuleVectorState.OFF,
                    rules: contentRules.on_but_disabled
                }
                self.state.externalContentRules = contentRules.other;
            }
            else {
                self.state.externalContentRules = contentRules.other;
            }

            // Get the master rule if any defined by the hs
            if (defaultRules.master.length > 0) {
                self.state.masterPushRule = defaultRules.master[0];
            }

            // Build the rules displayed in the Vector UI matrix table
            self.state.vectorPushRules = [];

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
                var ruleDefinition = VectorPushRulesDefinitions[vectorRuleId];

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
                    var rule = defaultRules.vector[vectorRuleId];

                    // Translate the rule actions and its enabled value into vector state
                    var vectorState;
                    if (rule) {
                        for (var stateKey in PushRuleVectorState) {
                            var state = PushRuleVectorState[stateKey];
                            var vectorStateToActions = ruleDefinition.vectorStateToActions[state];

                            if (vectorStateToActions === ACTION_DISABLED) {
                                // No defined actions means that this vector state expects a disabled default hs rule
                                if (rule.enabled === false) {
                                    vectorState = state;
                                    break;
                                }
                            }
                            else {
                                // The actions must match to the ones expected by vector state
                                if (JSON.stringify(rule.actions) === JSON.stringify(vectorStateToActions)) {
                                    // And the rule must be enabled.
                                    if (rule.enabled === true) {
                                        vectorState = state;
                                        break;
                                    }
                                }
                            }
                        }

                        if (!vectorState) {
                            console.error("Cannot translate rule actions into Vector rule state. Rule: " + rule); 
                            vectorState = PushRuleVectorState.OFF;
                        }
                    }
                    else {
                    	vectorState = PushRuleVectorState.OFF;
                    }

                    self.state.vectorPushRules.push({
                        "vectorRuleId": vectorRuleId,
                        "description" : ruleDefinition.description,
                        "rule": rule,
                        "vectorState": vectorState,
                    });
                }
            }
            
            // Build the rules not managed by Vector UI
            var otherRulesDescriptions = {
                '.m.rule.message': "Notify for all other messages/rooms",
                '.m.rule.fallback': "Notify me for anything else"
            };

            self.state.externalPushRules = [];
            for (var i in defaultRules.others) {
                var rule = defaultRules.others[i];
                var ruleDescription = otherRulesDescriptions[rule.rule_id];
                
                // Show enabled default rules that was modified by the user
                if (ruleDescription && rule.enabled && !rule.default) {
                    rule.description = ruleDescription;
                    self.state.externalPushRules.push(rule);
                }
            }

            self.setState({
                phase: self.phases.DISPLAY
            });
        });
    },
    
    _updatePushRuleActions: function(rule, actions, enabled) {
        var cli = MatrixClientPeg.get();
        var deferred = q.defer();

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
            <tr key = {className}>
                <th>
                    {title}
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

                <th>
                    <input className= {className + "-" + PushRuleVectorState.OFF}
                        type="radio"
                        checked={ pushRuleVectorState === PushRuleVectorState.OFF }
                        onChange={ this.onNotifStateButtonClicked } />
                </th>
            </tr>
        );
    },
    
    renderNotifRulesTableRows: function() {
        var rows = [];
        for (var i in this.state.vectorPushRules) {
            var rule = this.state.vectorPushRules[i];
            rows.push(this.renderNotifRulesTableRow(rule.description, rule.vectorRuleId, rule.vectorState));
        }
        return rows;
    },

    render: function() { 
        var self = this;

        if (this.state.phase === this.phases.LOADING) {
            var Loader = sdk.getComponent("elements.Spinner");
            return (
                <div className="mx_UserSettings_notifTable">
                    <Loader />
                </div>
            );
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
                                Enable notifications
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
                        All notifications are currently disabled for all devices.
                    </div>
                </div>
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

                    <h3>General use</h3>

                    <div className="mx_UserNotifSettings_pushRulesTableWrapper">
                        <table className="mx_UserNotifSettings_pushRulesTable">
                            <thead>
                                <tr>
                                    <th width="55%"></th>
                                    <th width="15%">On</th>
                                    <th width="15%">Loud</th>
                                    <th width="15%">Off</th>
                                </tr>
                            </thead>
                            <tbody>

                                { this.renderNotifRulesTableRows() }

                            </tbody>
                        </table>
                    </div>

                    { advancedSettings }
 
                </div>

            </div>
        );
    }
});
