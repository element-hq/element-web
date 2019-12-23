/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import {_t} from "../../../languageHandler";
import {IntegrationManagers} from "../../../integrations/IntegrationManagers";
import * as sdk from '../../../index';
import SettingsStore, {SettingLevel} from "../../../settings/SettingsStore";

export default class SetIntegrationManager extends React.Component {
    constructor() {
        super();

        const currentManager = IntegrationManagers.sharedInstance().getPrimaryManager();

        this.state = {
            currentManager,
            provisioningEnabled: SettingsStore.getValue("integrationProvisioning"),
        };
    }

    onProvisioningToggled = () => {
        const current = this.state.provisioningEnabled;
        SettingsStore.setValue("integrationProvisioning", null, SettingLevel.ACCOUNT, !current).catch(err => {
            console.error("Error changing integration manager provisioning");
            console.error(err);

            this.setState({provisioningEnabled: current});
        });
        this.setState({provisioningEnabled: !current});
    };

    render() {
        const ToggleSwitch = sdk.getComponent("views.elements.ToggleSwitch");

        const currentManager = this.state.currentManager;
        let managerName;
        let bodyText;
        if (currentManager) {
            managerName = `(${currentManager.name})`;
            bodyText = _t(
                "Use an Integration Manager <b>(%(serverName)s)</b> to manage bots, widgets, " +
                "and sticker packs.",
                {serverName: currentManager.name},
                { b: sub => <b>{sub}</b> },
            );
        } else {
            bodyText = _t("Use an Integration Manager to manage bots, widgets, and sticker packs.");
        }

        return (
            <div className='mx_SetIntegrationManager'>
                <div className="mx_SettingsTab_heading">
                    <span>{_t("Manage integrations")}</span>
                    <span className="mx_SettingsTab_subheading">{managerName}</span>
                    <ToggleSwitch checked={this.state.provisioningEnabled} onChange={this.onProvisioningToggled} />
                </div>
                <span className="mx_SettingsTab_subsectionText">
                    {bodyText}
                    <br />
                    <br />
                    {_t(
                        "Integration Managers receive configuration data, and can modify widgets, " +
                        "send room invites, and set power levels on your behalf.",
                    )}
                </span>
            </div>
        );
    }
}
