/*
Copyright 2016 OpenMarket Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import createReactClass from 'create-react-class';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import SettingsStore, {SettingLevel} from '../../../settings/SettingsStore';
import Modal from '../../../Modal';
import {
    NotificationUtils,
    VectorPushRulesDefinitions,
    PushRuleVectorState,
    ContentRules,
} from '../../../notifications';
import SdkConfig from "../../../SdkConfig";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import AccessibleButton from "../elements/AccessibleButton";

// TODO: this "view" component still has far too much application logic in it,
// which should be factored out to other files.

// TODO: this component also does a lot of direct poking into this.state, which
// is VERY NAUGHTY.


/**
 * Rules that Vector used to set in order to override the actions of default rules.
 * These are used to port peoples existing overrides to match the current API.
 * These can be removed and forgotten once everyone has moved to the new client.
 */
const LEGACY_RULES = {
    "im.vector.rule.contains_display_name": ".m.rule.contains_display_name",
    "im.vector.rule.room_one_to_one": ".m.rule.room_one_to_one",
    "im.vector.rule.room_message": ".m.rule.message",
    "im.vector.rule.invite_for_me": ".m.rule.invite_for_me",
    "im.vector.rule.call": ".m.rule.call",
    "im.vector.rule.notices": ".m.rule.suppress_notices",
};

function portLegacyActions(actions) {
    const decoded = NotificationUtils.decodeActions(actions);
    if (decoded !== null) {
        return NotificationUtils.encodeActions(decoded);
    } else {
        // We don't recognise one of the actions here, so we don't try to
        // canonicalise them.
        return actions;
    }
}

export default createReactClass({
    displayName: 'Notifications',

    phases: {
        LOADING: "LOADING", // The component is loading or sending data to the hs
        DISPLAY: "DISPLAY", // The component is ready and display data
        ERROR: "ERROR", // There was an error
    },

    getInitialState: function() {
        return {
            phase: this.phases.LOADING,
            masterPushRule: undefined, // The master rule ('.m.rule.master')
            vectorPushRules: [], // HS default push rules displayed in Vector UI
            vectorContentRules: { // Keyword push rules displayed in Vector UI
                vectorState: PushRuleVectorState.ON,
                rules: [],
            },
            externalPushRules: [], // Push rules (except content rule) that have been defined outside Vector UI
            externalContentRules: [], // Keyword push rules that have been defined outside Vector UI
            threepids: [], // used for email notifications
        };
    },

    componentDidMount: function() {
        this._refreshFromServer();
    },

    onEnableNotificationsChange: function(checked) {
        const self = this;
        this.setState({
            phase: this.phases.LOADING,
        });

        MatrixClientPeg.get().setPushRuleEnabled('global', self.state.masterPushRule.kind, self.state.masterPushRule.rule_id, !checked).then(function() {
           self._refreshFromServer();
        });
    },

    onEnableDesktopNotificationsChange: function(checked) {
        SettingsStore.setValue(
            "notificationsEnabled", null,
            SettingLevel.DEVICE,
            checked,
        ).finally(() => {
            this.forceUpdate();
        });
    },

    onEnableDesktopNotificationBodyChange: function(checked) {
        SettingsStore.setValue(
            "notificationBodyEnabled", null,
            SettingLevel.DEVICE,
            checked,
        ).finally(() => {
            this.forceUpdate();
        });
    },

    onEnableAudioNotificationsChange: function(checked) {
        SettingsStore.setValue(
            "audioNotificationsEnabled", null,
            SettingLevel.DEVICE,
            checked,
        ).finally(() => {
            this.forceUpdate();
        });
    },

    /*
     * Returns the email pusher (pusher of type 'email') for a given
     * email address. Email pushers all have the same app ID, so since
     * pushers are unique over (app ID, pushkey), there will be at most
     * one such pusher.
     */
    getEmailPusher: function(pushers, address) {
        if (pushers === undefined) {
            return undefined;
        }
        for (let i = 0; i < pushers.length; ++i) {
            if (pushers[i].kind === 'email' && pushers[i].pushkey === address) {
                return pushers[i];
            }
        }
        return undefined;
    },

    onEnableEmailNotificationsChange: function(address, checked) {
        let emailPusherPromise;
        if (checked) {
            const data = {};
            data['brand'] = SdkConfig.get().brand;
            emailPusherPromise = MatrixClientPeg.get().setPusher({
                kind: 'email',
                app_id: 'm.email',
                pushkey: address,
                app_display_name: 'Email Notifications',
                device_display_name: address,
                lang: navigator.language,
                data: data,
                append: true, // We always append for email pushers since we don't want to stop other accounts notifying to the same email address
            });
        } else {
            const emailPusher = this.getEmailPusher(this.state.pushers, address);
            emailPusher.kind = null;
            emailPusherPromise = MatrixClientPeg.get().setPusher(emailPusher);
        }
        emailPusherPromise.then(() => {
            this._refreshFromServer();
        }, (error) => {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Error saving email notification preferences', '', ErrorDialog, {
                title: _t('Error saving email notification preferences'),
                description: _t('An error occurred whilst saving your email notification preferences.'),
            });
        });
    },

    onNotifStateButtonClicked: function(event) {
        // FIXME: use .bind() rather than className metadata here surely
        const vectorRuleId = event.target.className.split("-")[0];
        const newPushRuleVectorState = event.target.className.split("-")[1];

        if ("_keywords" === vectorRuleId) {
            this._setKeywordsPushRuleVectorState(newPushRuleVectorState);
        } else {
            const rule = this.getRule(vectorRuleId);
            if (rule) {
                this._setPushRuleVectorState(rule, newPushRuleVectorState);
            }
        }
    },

    onKeywordsClicked: function(event) {
        const self = this;

        // Compute the keywords list to display
        let keywords = [];
        for (const i in this.state.vectorContentRules.rules) {
            const rule = this.state.vectorContentRules.rules[i];
            keywords.push(rule.pattern);
        }
        if (keywords.length) {
            // As keeping the order of per-word push rules hs side is a bit tricky to code,
            // display the keywords in alphabetical order to the user
            keywords.sort();

            keywords = keywords.join(", ");
        } else {
            keywords = "";
        }

        const TextInputDialog = sdk.getComponent("dialogs.TextInputDialog");
        Modal.createTrackedDialog('Keywords Dialog', '', TextInputDialog, {
            title: _t('Keywords'),
            description: _t('Enter keywords separated by a comma:'),
            button: _t('OK'),
            value: keywords,
            onFinished: function onFinished(should_leave, newValue) {
                if (should_leave && newValue !== keywords) {
                    let newKeywords = newValue.split(',');
                    for (const i in newKeywords) {
                        newKeywords[i] = newKeywords[i].trim();
                    }

                    // Remove duplicates and empty
                    newKeywords = newKeywords.reduce(function(array, keyword) {
                        if (keyword !== "" && array.indexOf(keyword) < 0) {
                            array.push(keyword);
                        }
                        return array;
                    }, []);

                    self._setKeywords(newKeywords);
                }
            },
        });
    },

    getRule: function(vectorRuleId) {
        for (const i in this.state.vectorPushRules) {
            const rule = this.state.vectorPushRules[i];
            if (rule.vectorRuleId === vectorRuleId) {
                return rule;
            }
        }
    },

    _setPushRuleVectorState: function(rule, newPushRuleVectorState) {
        if (rule && rule.vectorState !== newPushRuleVectorState) {
            this.setState({
                phase: this.phases.LOADING,
            });

            const self = this;
            const cli = MatrixClientPeg.get();
            const deferreds = [];
            const ruleDefinition = VectorPushRulesDefinitions[rule.vectorRuleId];

            if (rule.rule) {
                const actions = ruleDefinition.vectorStateToActions[newPushRuleVectorState];

                if (!actions) {
                    // The new state corresponds to disabling the rule.
                    deferreds.push(cli.setPushRuleEnabled('global', rule.rule.kind, rule.rule.rule_id, false));
                } else {
                    // The new state corresponds to enabling the rule and setting specific actions
                    deferreds.push(this._updatePushRuleActions(rule.rule, actions, true));
                }
            }

            Promise.all(deferreds).then(function() {
                self._refreshFromServer();
            }, function(error) {
                const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                console.error("Failed to change settings: " + error);
                Modal.createTrackedDialog('Failed to change settings', '', ErrorDialog, {
                    title: _t('Failed to change settings'),
                    description: ((error && error.message) ? error.message : _t('Operation failed')),
                    onFinished: self._refreshFromServer,
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

        const self = this;
        const cli = MatrixClientPeg.get();

        this.setState({
            phase: this.phases.LOADING,
        });

        // Update all rules in self.state.vectorContentRules
        const deferreds = [];
        for (const i in this.state.vectorContentRules.rules) {
            const rule = this.state.vectorContentRules.rules[i];

            let enabled; let actions;
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
            } else if (enabled != undefined) {
                deferreds.push(cli.setPushRuleEnabled('global', rule.kind, rule.rule_id, enabled));
            }
        }

        Promise.all(deferreds).then(function(resps) {
            self._refreshFromServer();
        }, function(error) {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            console.error("Can't update user notification settings: " + error);
            Modal.createTrackedDialog('Can\'t update user notifcation settings', '', ErrorDialog, {
                title: _t('Can\'t update user notification settings'),
                description: ((error && error.message) ? error.message : _t('Operation failed')),
                onFinished: self._refreshFromServer,
            });
        });
    },

    _setKeywords: function(newKeywords) {
        this.setState({
            phase: this.phases.LOADING,
        });

        const self = this;
        const cli = MatrixClientPeg.get();
        const removeDeferreds = [];

        // Remove per-word push rules of keywords that are no more in the list
        const vectorContentRulesPatterns = [];
        for (const i in self.state.vectorContentRules.rules) {
            const rule = self.state.vectorContentRules.rules[i];

            vectorContentRulesPatterns.push(rule.pattern);

            if (newKeywords.indexOf(rule.pattern) < 0) {
                removeDeferreds.push(cli.deletePushRule('global', rule.kind, rule.rule_id));
            }
        }

        // If the keyword is part of `externalContentRules`, remove the rule
        // before recreating it in the right Vector path
        for (const i in self.state.externalContentRules) {
            const rule = self.state.externalContentRules[i];

            if (newKeywords.indexOf(rule.pattern) >= 0) {
                removeDeferreds.push(cli.deletePushRule('global', rule.kind, rule.rule_id));
            }
        }

        const onError = function(error) {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            console.error("Failed to update keywords: " + error);
            Modal.createTrackedDialog('Failed to update keywords', '', ErrorDialog, {
                title: _t('Failed to update keywords'),
                description: ((error && error.message) ? error.message : _t('Operation failed')),
                onFinished: self._refreshFromServer,
            });
        };

        // Then, add the new ones
        Promise.all(removeDeferreds).then(function(resps) {
            const deferreds = [];

            let pushRuleVectorStateKind = self.state.vectorContentRules.vectorState;
            if (pushRuleVectorStateKind === PushRuleVectorState.OFF) {
                // When the current global keywords rule is OFF, we need to look at
                // the flavor of rules in 'vectorContentRules' to apply the same actions
                // when creating the new rule.
                // Thus, this new rule will join the 'vectorContentRules' set.
                if (self.state.vectorContentRules.rules.length) {
                    pushRuleVectorStateKind = PushRuleVectorState.contentRuleVectorStateKind(self.state.vectorContentRules.rules[0]);
                } else {
                    // ON is default
                    pushRuleVectorStateKind = PushRuleVectorState.ON;
                }
            }

            for (const i in newKeywords) {
                const keyword = newKeywords[i];

                if (vectorContentRulesPatterns.indexOf(keyword) < 0) {
                    if (self.state.vectorContentRules.vectorState !== PushRuleVectorState.OFF) {
                        deferreds.push(cli.addPushRule
                        ('global', 'content', keyword, {
                           actions: PushRuleVectorState.actionsFor(pushRuleVectorStateKind),
                           pattern: keyword,
                        }));
                    } else {
                        deferreds.push(self._addDisabledPushRule('global', 'content', keyword, {
                           actions: PushRuleVectorState.actionsFor(pushRuleVectorStateKind),
                           pattern: keyword,
                        }));
                    }
                }
            }

            Promise.all(deferreds).then(function(resps) {
                self._refreshFromServer();
            }, onError);
        }, onError);
    },

    // Create a push rule but disabled
    _addDisabledPushRule: function(scope, kind, ruleId, body) {
        const cli = MatrixClientPeg.get();
        return cli.addPushRule(scope, kind, ruleId, body).then(() =>
            cli.setPushRuleEnabled(scope, kind, ruleId, false),
        );
    },

    // Check if any legacy im.vector rules need to be ported to the new API
    // for overriding the actions of default rules.
    _portRulesToNewAPI: function(rulesets) {
        const needsUpdate = [];
        const cli = MatrixClientPeg.get();

        for (const kind in rulesets.global) {
            const ruleset = rulesets.global[kind];
            for (let i = 0; i < ruleset.length; ++i) {
                const rule = ruleset[i];
                if (rule.rule_id in LEGACY_RULES) {
                    console.log("Porting legacy rule", rule);
                    needsUpdate.push( function(kind, rule) {
                        return cli.setPushRuleActions(
                            'global', kind, LEGACY_RULES[rule.rule_id], portLegacyActions(rule.actions),
                        ).then(() =>
                            cli.deletePushRule('global', kind, rule.rule_id),
                        ).catch( (e) => {
                            console.warn(`Error when porting legacy rule: ${e}`);
                        });
                    }(kind, rule));
                }
            }
        }

        if (needsUpdate.length > 0) {
            // If some of the rules need to be ported then wait for the porting
            // to happen and then fetch the rules again.
            return Promise.all(needsUpdate).then(() =>
                cli.getPushRules(),
            );
        } else {
            // Otherwise return the rules that we already have.
            return rulesets;
        }
    },

    _refreshFromServer: function() {
        const self = this;
        const pushRulesPromise = MatrixClientPeg.get().getPushRules().then(self._portRulesToNewAPI).then(function(rulesets) {
            /// XXX seriously? wtf is this?
            MatrixClientPeg.get().pushRules = rulesets;

            // Get homeserver default rules and triage them by categories
            const rule_categories = {
                // The master rule (all notifications disabling)
                '.m.rule.master': 'master',

                // The default push rules displayed by Vector UI
                '.m.rule.contains_display_name': 'vector',
                '.m.rule.contains_user_name': 'vector',
                '.m.rule.roomnotif': 'vector',
                '.m.rule.room_one_to_one': 'vector',
                '.m.rule.encrypted_room_one_to_one': 'vector',
                '.m.rule.message': 'vector',
                '.m.rule.encrypted': 'vector',
                '.m.rule.invite_for_me': 'vector',
                //'.m.rule.member_event': 'vector',
                '.m.rule.call': 'vector',
                '.m.rule.suppress_notices': 'vector',
                '.m.rule.tombstone': 'vector',

                // Others go to others
            };

            // HS default rules
            const defaultRules = {master: [], vector: {}, others: []};

            for (const kind in rulesets.global) {
                for (let i = 0; i < Object.keys(rulesets.global[kind]).length; ++i) {
                    const r = rulesets.global[kind][i];
                    const cat = rule_categories[r.rule_id];
                    r.kind = kind;

                    if (r.rule_id[0] === '.') {
                        if (cat === 'vector') {
                            defaultRules.vector[r.rule_id] = r;
                        } else if (cat === 'master') {
                            defaultRules.master.push(r);
                        } else {
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
            const contentRules = ContentRules.parseContentRules(rulesets);
            self.state.vectorContentRules = {
                vectorState: contentRules.vectorState,
                rules: contentRules.rules,
            };
            self.state.externalContentRules = contentRules.externalRules;

            // Build the rules displayed in the Vector UI matrix table
            self.state.vectorPushRules = [];
            self.state.externalPushRules = [];

            const vectorRuleIds = [
                '.m.rule.contains_display_name',
                '.m.rule.contains_user_name',
                '.m.rule.roomnotif',
                '_keywords',
                '.m.rule.room_one_to_one',
                '.m.rule.encrypted_room_one_to_one',
                '.m.rule.message',
                '.m.rule.encrypted',
                '.m.rule.invite_for_me',
                //'im.vector.rule.member_event',
                '.m.rule.call',
                '.m.rule.suppress_notices',
                '.m.rule.tombstone',
            ];
            for (const i in vectorRuleIds) {
                const vectorRuleId = vectorRuleIds[i];

                if (vectorRuleId === '_keywords') {
                    // keywords needs a special handling
                    // For Vector UI, this is a single global push rule but translated in Matrix,
                    // it corresponds to all content push rules (stored in self.state.vectorContentRule)
                    self.state.vectorPushRules.push({
                        "vectorRuleId": "_keywords",
                        "description": (
                            <span>
                            { _t('Messages containing <span>keywords</span>',
                                {},
                                { 'span': (sub) =>
                                    <span className="mx_UserNotifSettings_keywords" onClick={ self.onKeywordsClicked }>{sub}</span>,
                                },
                            )}
                            </span>
                        ),
                        "vectorState": self.state.vectorContentRules.vectorState,
                    });
                } else {
                    const ruleDefinition = VectorPushRulesDefinitions[vectorRuleId];
                    const rule = defaultRules.vector[vectorRuleId];

                    const vectorState = ruleDefinition.ruleToVectorState(rule);

                    //console.log("Refreshing vectorPushRules for " + vectorRuleId +", "+ ruleDefinition.description +", " + rule +", " + vectorState);

                    self.state.vectorPushRules.push({
                        "vectorRuleId": vectorRuleId,
                        "description": _t(ruleDefinition.description), // Text from VectorPushRulesDefinitions.js
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
            const otherRulesDescriptions = {
                '.m.rule.message': _t('Notify for all other messages/rooms'),
                '.m.rule.fallback': _t('Notify me for anything else'),
            };

            for (const i in defaultRules.others) {
                const rule = defaultRules.others[i];
                const ruleDescription = otherRulesDescriptions[rule.rule_id];

                // Show enabled default rules that was modified by the user
                if (ruleDescription && rule.enabled && !rule.default) {
                    rule.description = ruleDescription;
                    self.state.externalPushRules.push(rule);
                }
            }
        });

        const pushersPromise = MatrixClientPeg.get().getPushers().then(function(resp) {
            self.setState({pushers: resp.pushers});
        });

        Promise.all([pushRulesPromise, pushersPromise]).then(function() {
            self.setState({
                phase: self.phases.DISPLAY,
            });
        }, function(error) {
            console.error(error);
            self.setState({
                phase: self.phases.ERROR,
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
        });

        MatrixClientPeg.get().getThreePids().then((r) => this.setState({threepids: r.threepids}));
    },

    _onClearNotifications: function() {
        const cli = MatrixClientPeg.get();

        cli.getRooms().forEach(r => {
            if (r.getUnreadNotificationCount() > 0) {
                const events = r.getLiveTimeline().getEvents();
                if (events.length) cli.sendReadReceipt(events.pop());
            }
        });
    },

    _updatePushRuleActions: function(rule, actions, enabled) {
        const cli = MatrixClientPeg.get();

        return cli.setPushRuleActions(
            'global', rule.kind, rule.rule_id, actions,
        ).then( function() {
            // Then, if requested, enabled or disabled the rule
            if (undefined != enabled) {
                return cli.setPushRuleEnabled(
                    'global', rule.kind, rule.rule_id, enabled,
                );
            }
        });
    },

    renderNotifRulesTableRow: function(title, className, pushRuleVectorState) {
        return (
            <tr key={ className }>
                <th>
                    { title }
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
        const rows = [];
        for (const i in this.state.vectorPushRules) {
            const rule = this.state.vectorPushRules[i];
            if (rule.rule === undefined && rule.vectorRuleId.startsWith(".m.")) {
                console.warn(`Skipping render of rule ${rule.vectorRuleId} due to no underlying rule`);
                continue;
            }
            //console.log("rendering: " + rule.description + ", " + rule.vectorRuleId + ", " + rule.vectorState);
            rows.push(this.renderNotifRulesTableRow(rule.description, rule.vectorRuleId, rule.vectorState));
        }
        return rows;
    },

    hasEmailPusher: function(pushers, address) {
        if (pushers === undefined) {
            return false;
        }
        for (let i = 0; i < pushers.length; ++i) {
            if (pushers[i].kind === 'email' && pushers[i].pushkey === address) {
                return true;
            }
        }
        return false;
    },

    emailNotificationsRow: function(address, label) {
        return <LabelledToggleSwitch value={this.hasEmailPusher(this.state.pushers, address)}
                                     onChange={this.onEnableEmailNotificationsChange.bind(this, address)}
                                     label={label} key={`emailNotif_${label}`} />;
    },

    render: function() {
        let spinner;
        if (this.state.phase === this.phases.LOADING) {
            const Loader = sdk.getComponent("elements.Spinner");
            spinner = <Loader />;
        }

        let masterPushRuleDiv;
        if (this.state.masterPushRule) {
            masterPushRuleDiv = <LabelledToggleSwitch value={!this.state.masterPushRule.enabled}
                                                      onChange={this.onEnableNotificationsChange}
                                                      label={_t('Enable notifications for this account')}/>;
        }

        let clearNotificationsButton;
        if (MatrixClientPeg.get().getRooms().some(r => r.getUnreadNotificationCount() > 0)) {
            clearNotificationsButton = <AccessibleButton onClick={this._onClearNotifications} kind='danger'>
                {_t("Clear notifications")}
            </AccessibleButton>;
        }

        // When enabled, the master rule inhibits all existing rules
        // So do not show all notification settings
        if (this.state.masterPushRule && this.state.masterPushRule.enabled) {
            return (
                <div>
                    {masterPushRuleDiv}

                    <div className="mx_UserNotifSettings_notifTable">
                        { _t('All notifications are currently disabled for all targets.') }
                    </div>

                    {clearNotificationsButton}
                </div>
            );
        }

        const emailThreepids = this.state.threepids.filter((tp) => tp.medium === "email");
        let emailNotificationsRows;
        if (emailThreepids.length === 0) {
            emailNotificationsRows = <div>
                { _t('Add an email address to configure email notifications') }
            </div>;
        } else {
            emailNotificationsRows = emailThreepids.map((threePid) => this.emailNotificationsRow(
                threePid.address, `${_t('Enable email notifications')} (${threePid.address})`,
            ));
        }

        // Build external push rules
        const externalRules = [];
        for (const i in this.state.externalPushRules) {
            const rule = this.state.externalPushRules[i];
            externalRules.push(<li>{ _t(rule.description) }</li>);
        }

        // Show keywords not displayed by the vector UI as a single external push rule
        let externalKeywords = [];
        for (const i in this.state.externalContentRules) {
            const rule = this.state.externalContentRules[i];
            externalKeywords.push(rule.pattern);
        }
        if (externalKeywords.length) {
            externalKeywords = externalKeywords.join(", ");
            externalRules.push(<li>{ _t('Notifications on the following keywords follow rules which can’t be displayed here:') } { externalKeywords }</li>);
        }

        let devicesSection;
        if (this.state.pushers === undefined) {
            devicesSection = <div className="error">{ _t('Unable to fetch notification target list') }</div>;
        } else if (this.state.pushers.length === 0) {
            devicesSection = null;
        } else {
            // TODO: It would be great to be able to delete pushers from here too,
            // and this wouldn't be hard to add.
            const rows = [];
            for (let i = 0; i < this.state.pushers.length; ++i) {
                rows.push(<tr key={ i }>
                    <td>{this.state.pushers[i].app_display_name}</td>
                    <td>{this.state.pushers[i].device_display_name}</td>
                </tr>);
            }
            devicesSection = (<table className="mx_UserNotifSettings_devicesTable">
                <tbody>
                    {rows}
                </tbody>
            </table>);
        }
        if (devicesSection) {
            devicesSection = (<div>
                <h3>{ _t('Notification targets') }</h3>
                { devicesSection }
            </div>);
        }

        let advancedSettings;
        if (externalRules.length) {
            const brand = SdkConfig.get().brand;
            advancedSettings = (
                <div>
                    <h3>{ _t('Advanced notification settings') }</h3>
                    { _t('There are advanced notifications which are not shown here.') }<br />
                    {_t(
                        'You might have configured them in a client other than %(brand)s. ' +
                        'You cannot tune them in %(brand)s but they still apply.',
                        { brand },
                    )}
                    <ul>
                        { externalRules }
                    </ul>
                </div>
            );
        }

        return (
            <div>

                {masterPushRuleDiv}

                <div className="mx_UserNotifSettings_notifTable">

                    { spinner }

                    <LabelledToggleSwitch value={SettingsStore.getValue("notificationsEnabled")}
                                          onChange={this.onEnableDesktopNotificationsChange}
                                          label={_t('Enable desktop notifications for this session')} />

                    <LabelledToggleSwitch value={SettingsStore.getValue("notificationBodyEnabled")}
                                          onChange={this.onEnableDesktopNotificationBodyChange}
                                          label={_t('Show message in desktop notification')} />

                    <LabelledToggleSwitch value={SettingsStore.getValue("audioNotificationsEnabled")}
                                          onChange={this.onEnableAudioNotificationsChange}
                                          label={_t('Enable audible notifications for this session')} />

                    { emailNotificationsRows }

                    <div className="mx_UserNotifSettings_pushRulesTableWrapper">
                        <table className="mx_UserNotifSettings_pushRulesTable">
                            <thead>
                                <tr>
                                    <th width="55%"></th>
                                    <th width="15%">{ _t('Off') }</th>
                                    <th width="15%">{ _t('On') }</th>
                                    <th width="15%">{ _t('Noisy') }</th>
                                </tr>
                            </thead>
                            <tbody>

                                { this.renderNotifRulesTableRows() }

                            </tbody>
                        </table>
                    </div>

                    { advancedSettings }

                    { devicesSection }

                    { clearNotificationsButton }
                </div>

            </div>
        );
    },
});
