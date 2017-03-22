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

module.exports = React.createClass({
    displayName: 'Language',

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
    render: function() {
        var self = this;

        var spinner;
        if (this.state.phase === this.phases.LOADING) {
            var Loader = sdk.getComponent("elements.Spinner");
            spinner = <Loader />;
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
                                    <th width="15%">Noisy</th>
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
