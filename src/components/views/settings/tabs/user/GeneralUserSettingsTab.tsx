/*
Copyright 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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
import { HTTPError } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { UserFriendlyError, _t } from "../../../../../languageHandler";
import UserProfileSettings from "../../UserProfileSettings";
import SettingsStore from "../../../../../settings/SettingsStore";
import AccessibleButton from "../../../elements/AccessibleButton";
import DeactivateAccountDialog from "../../../dialogs/DeactivateAccountDialog";
import Modal from "../../../../../Modal";
import { UIFeature } from "../../../../../settings/UIFeature";
import ErrorDialog, { extractErrorMessageFromError } from "../../../dialogs/ErrorDialog";
import ChangePassword from "../../ChangePassword";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import SettingsSubsection, { SettingsSubsectionText } from "../../shared/SettingsSubsection";
import { SDKContext } from "../../../../../contexts/SDKContext";
import UserPersonalInfoSettings from "../../UserPersonalInfoSettings";

interface IProps {
    closeSettingsFn: () => void;
}

interface IState {
    canChangePassword: boolean;
    idServerName?: string;
    externalAccountManagementUrl?: string;
    canMake3pidChanges: boolean;
    canSetDisplayName: boolean;
    canSetAvatar: boolean;
}

export default class GeneralUserSettingsTab extends React.Component<IProps, IState> {
    public static contextType = SDKContext;
    public declare context: React.ContextType<typeof SDKContext>;

    public constructor(props: IProps, context: React.ContextType<typeof SDKContext>) {
        super(props);

        this.state = {
            canChangePassword: false,
            canMake3pidChanges: false,
            canSetDisplayName: false,
            canSetAvatar: false,
        };

        this.getCapabilities();
    }

    private async getCapabilities(): Promise<void> {
        const cli = this.context.client!;

        const capabilities = (await cli.getCapabilities()) ?? {};
        const changePasswordCap = capabilities["m.change_password"];

        // You can change your password so long as the capability isn't explicitly disabled. The implicit
        // behaviour is you can change your password when the capability is missing or has not-false as
        // the enabled flag value.
        const canChangePassword = !changePasswordCap || changePasswordCap["enabled"] !== false;

        await this.context.oidcClientStore.readyPromise; // wait for the store to be ready
        const externalAccountManagementUrl = this.context.oidcClientStore.accountManagementEndpoint;
        // https://spec.matrix.org/v1.7/client-server-api/#m3pid_changes-capability
        // We support as far back as v1.1 which doesn't have m.3pid_changes
        // so the behaviour for when it is missing has to be assume true
        const canMake3pidChanges = !capabilities["m.3pid_changes"] || capabilities["m.3pid_changes"].enabled === true;

        const canSetDisplayName =
            !capabilities["m.set_displayname"] || capabilities["m.set_displayname"].enabled === true;
        const canSetAvatar = !capabilities["m.set_avatar_url"] || capabilities["m.set_avatar_url"].enabled === true;

        this.setState({
            canChangePassword,
            externalAccountManagementUrl,
            canMake3pidChanges,
            canSetDisplayName,
            canSetAvatar,
        });
    }

    private onPasswordChangeError = (err: Error): void => {
        logger.error("Failed to change password: " + err);

        let underlyingError = err;
        if (err instanceof UserFriendlyError && err.cause instanceof Error) {
            underlyingError = err.cause;
        }

        const errorMessage = extractErrorMessageFromError(
            err,
            _t("settings|general|error_password_change_unknown", {
                stringifiedError: String(err),
            }),
        );

        let errorMessageToDisplay = errorMessage;
        if (underlyingError instanceof HTTPError && underlyingError.httpStatus === 403) {
            errorMessageToDisplay = _t("settings|general|error_password_change_403");
        } else if (underlyingError instanceof HTTPError) {
            errorMessageToDisplay = _t("settings|general|error_password_change_http", {
                errorMessage,
                httpStatus: underlyingError.httpStatus,
            });
        }

        // TODO: Figure out a design that doesn't involve replacing the current dialog
        Modal.createDialog(ErrorDialog, {
            title: _t("settings|general|error_password_change_title"),
            description: errorMessageToDisplay,
        });
    };

    private onPasswordChanged = (): void => {
        const description = _t("settings|general|password_change_success");
        // TODO: Figure out a design that doesn't involve replacing the current dialog
        Modal.createDialog(ErrorDialog, {
            title: _t("common|success"),
            description,
        });
    };

    private onDeactivateClicked = (): void => {
        Modal.createDialog(DeactivateAccountDialog, {
            onFinished: (success) => {
                if (success) this.props.closeSettingsFn();
            },
        });
    };

    private renderAccountSection(): JSX.Element | undefined {
        if (!this.state.canChangePassword) return undefined;

        return (
            <>
                <SettingsSubsection
                    heading={_t("settings|general|account_section")}
                    stretchContent
                    data-testid="accountSection"
                >
                    <SettingsSubsectionText>{_t("settings|general|password_change_section")}</SettingsSubsectionText>
                    <ChangePassword
                        className="mx_GeneralUserSettingsTab_section--account_changePassword"
                        rowClassName=""
                        buttonKind="primary"
                        onError={this.onPasswordChangeError}
                        onFinished={this.onPasswordChanged}
                    />
                </SettingsSubsection>
            </>
        );
    }

    private renderManagementSection(): JSX.Element {
        // TODO: Improve warning text for account deactivation
        return (
            <SettingsSection heading={_t("settings|general|deactivate_section")}>
                <SettingsSubsection
                    heading={_t("settings|general|account_management_section")}
                    data-testid="account-management-section"
                    description={_t("settings|general|deactivate_warning")}
                >
                    <AccessibleButton onClick={this.onDeactivateClicked} kind="danger">
                        {_t("settings|general|deactivate_section")}
                    </AccessibleButton>
                </SettingsSubsection>
            </SettingsSection>
        );
    }

    public render(): React.ReactNode {
        let accountManagementSection: JSX.Element | undefined;
        const isAccountManagedExternally = !!this.state.externalAccountManagementUrl;
        if (SettingsStore.getValue(UIFeature.Deactivate) && !isAccountManagedExternally) {
            accountManagementSection = this.renderManagementSection();
        }

        return (
            <SettingsTab data-testid="mx_GeneralUserSettingsTab">
                <SettingsSection>
                    <UserProfileSettings
                        externalAccountManagementUrl={this.state.externalAccountManagementUrl}
                        canSetDisplayName={this.state.canSetDisplayName}
                        canSetAvatar={this.state.canSetAvatar}
                    />
                    <UserPersonalInfoSettings canMake3pidChanges={this.state.canMake3pidChanges} />
                    {this.renderAccountSection()}
                </SettingsSection>
                {accountManagementSection}
            </SettingsTab>
        );
    }
}
