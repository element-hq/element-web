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

import React from "react";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import { IntegrationManagers } from "../../../integrations/IntegrationManagers";
import { IntegrationManagerInstance } from "../../../integrations/IntegrationManagerInstance";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import ToggleSwitch from "../elements/ToggleSwitch";
import Heading from "../typography/Heading";
import { SettingsSubsectionText } from "./shared/SettingsSubsection";

interface IProps {}

interface IState {
    currentManager: IntegrationManagerInstance | null;
    provisioningEnabled: boolean;
}

export default class SetIntegrationManager extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        const currentManager = IntegrationManagers.sharedInstance().getPrimaryManager();

        this.state = {
            currentManager,
            provisioningEnabled: SettingsStore.getValue("integrationProvisioning"),
        };
    }

    private onProvisioningToggled = (): void => {
        const current = this.state.provisioningEnabled;
        SettingsStore.setValue("integrationProvisioning", null, SettingLevel.ACCOUNT, !current).catch((err) => {
            logger.error("Error changing integration manager provisioning");
            logger.error(err);

            this.setState({ provisioningEnabled: current });
        });
        this.setState({ provisioningEnabled: !current });
    };

    public render(): React.ReactNode {
        const currentManager = this.state.currentManager;
        let managerName;
        let bodyText;
        if (currentManager) {
            managerName = `(${currentManager.name})`;
            bodyText = _t(
                "Use an integration manager <b>(%(serverName)s)</b> to manage bots, widgets, " + "and sticker packs.",
                { serverName: currentManager.name },
                { b: (sub) => <b>{sub}</b> },
            );
        } else {
            bodyText = _t("Use an integration manager to manage bots, widgets, and sticker packs.");
        }

        return (
            <label
                className="mx_SetIntegrationManager"
                data-testid="mx_SetIntegrationManager"
                htmlFor="toggle_integration"
            >
                <div className="mx_SettingsFlag">
                    <div className="mx_SetIntegrationManager_heading_manager">
                        <Heading size="h2">{_t("Manage integrations")}</Heading>
                        <Heading size="h3">{managerName}</Heading>
                    </div>
                    <ToggleSwitch
                        id="toggle_integration"
                        checked={this.state.provisioningEnabled}
                        disabled={false}
                        onChange={this.onProvisioningToggled}
                    />
                </div>
                <SettingsSubsectionText>{bodyText}</SettingsSubsectionText>
                <SettingsSubsectionText>
                    {_t(
                        "Integration managers receive configuration data, and can modify widgets, " +
                            "send room invites, and set power levels on your behalf.",
                    )}
                </SettingsSubsectionText>
            </label>
        );
    }
}
