/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
import { UIFeature } from "../../../settings/UIFeature";

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
                "integration_manager|use_im_default",
                { serverName: currentManager.name },
                { b: (sub) => <strong>{sub}</strong> },
            );
        } else {
            bodyText = _t("integration_manager|use_im");
        }

        if (!SettingsStore.getValue(UIFeature.Widgets)) return null;

        return (
            <label
                className="mx_SetIntegrationManager"
                data-testid="mx_SetIntegrationManager"
                htmlFor="toggle_integration"
            >
                <div className="mx_SettingsFlag">
                    <div className="mx_SetIntegrationManager_heading_manager">
                        <Heading size="3">{_t("integration_manager|manage_title")}</Heading>
                        <Heading size="4">{managerName}</Heading>
                    </div>
                    <ToggleSwitch
                        id="toggle_integration"
                        checked={this.state.provisioningEnabled}
                        disabled={false}
                        onChange={this.onProvisioningToggled}
                    />
                </div>
                <SettingsSubsectionText>{bodyText}</SettingsSubsectionText>
                <SettingsSubsectionText>{_t("integration_manager|explainer")}</SettingsSubsectionText>
            </label>
        );
    }
}
