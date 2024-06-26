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

import React, { ReactNode } from "react";
import { HTTPError } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { UserFriendlyError, _t } from "../../../../../languageHandler";
import UserProfileSettings from "../../UserProfileSettings";
import * as languageHandler from "../../../../../languageHandler";
import SettingsStore from "../../../../../settings/SettingsStore";
import LanguageDropdown from "../../../elements/LanguageDropdown";
import SpellCheckSettings from "../../SpellCheckSettings";
import AccessibleButton from "../../../elements/AccessibleButton";
import DeactivateAccountDialog from "../../../dialogs/DeactivateAccountDialog";
import PlatformPeg from "../../../../../PlatformPeg";
import Modal from "../../../../../Modal";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import { UIFeature } from "../../../../../settings/UIFeature";
import ErrorDialog, { extractErrorMessageFromError } from "../../../dialogs/ErrorDialog";
import ChangePassword from "../../ChangePassword";
import SetIntegrationManager from "../../SetIntegrationManager";
import ToggleSwitch from "../../../elements/ToggleSwitch";
import { IS_MAC } from "../../../../../Keyboard";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import SettingsSubsection, { SettingsSubsectionText } from "../../shared/SettingsSubsection";
import { SettingsSubsectionHeading } from "../../shared/SettingsSubsectionHeading";
import { SDKContext } from "../../../../../contexts/SDKContext";
import UserPersonalInfoSettings from "../../UserPersonalInfoSettings";

interface IProps {
    closeSettingsFn: () => void;
}

interface IState {
    language: string;
    spellCheckEnabled?: boolean;
    spellCheckLanguages: string[];
    canChangePassword: boolean;
    idServerName?: string;
    externalAccountManagementUrl?: string;
    canMake3pidChanges: boolean;
}

export default class GeneralUserSettingsTab extends React.Component<IProps, IState> {
    public static contextType = SDKContext;
    public context!: React.ContextType<typeof SDKContext>;

    public constructor(props: IProps, context: React.ContextType<typeof SDKContext>) {
        super(props);
        this.context = context;

        this.state = {
            language: languageHandler.getCurrentLanguage(),
            spellCheckEnabled: false,
            spellCheckLanguages: [],
            canChangePassword: false,
            canMake3pidChanges: false,
        };

        this.getCapabilities();
    }

    public async componentDidMount(): Promise<void> {
        const plat = PlatformPeg.get();
        const [spellCheckEnabled, spellCheckLanguages] = await Promise.all([
            plat?.getSpellCheckEnabled(),
            plat?.getSpellCheckLanguages(),
        ]);

        if (spellCheckLanguages) {
            this.setState({
                spellCheckEnabled,
                spellCheckLanguages,
            });
        }
    }

    private async getCapabilities(): Promise<void> {
        const cli = this.context.client!;

        const capabilities = await cli.getCapabilities(); // this is cached
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

        this.setState({ canChangePassword, externalAccountManagementUrl, canMake3pidChanges });
    }

    private onLanguageChange = (newLanguage: string): void => {
        if (this.state.language === newLanguage) return;

        SettingsStore.setValue("language", null, SettingLevel.DEVICE, newLanguage);
        this.setState({ language: newLanguage });
        const platform = PlatformPeg.get();
        if (platform) {
            platform.setLanguage([newLanguage]);
            platform.reload();
        }
    };

    private onSpellCheckLanguagesChange = (languages: string[]): void => {
        this.setState({ spellCheckLanguages: languages });
        PlatformPeg.get()?.setSpellCheckLanguages(languages);
    };

    private onSpellCheckEnabledChange = (spellCheckEnabled: boolean): void => {
        this.setState({ spellCheckEnabled });
        PlatformPeg.get()?.setSpellCheckEnabled(spellCheckEnabled);
    };

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

    private renderAccountSection(): JSX.Element {
        let passwordChangeSection: ReactNode = null;
        if (this.state.canChangePassword) {
            passwordChangeSection = (
                <>
                    <SettingsSubsectionText>{_t("settings|general|password_change_section")}</SettingsSubsectionText>
                    <ChangePassword
                        className="mx_GeneralUserSettingsTab_section--account_changePassword"
                        rowClassName=""
                        buttonKind="primary"
                        onError={this.onPasswordChangeError}
                        onFinished={this.onPasswordChanged}
                    />
                </>
            );
        }

        let externalAccountManagement: JSX.Element | undefined;
        if (this.state.externalAccountManagementUrl) {
            const { hostname } = new URL(this.state.externalAccountManagementUrl);

            externalAccountManagement = (
                <>
                    <SettingsSubsectionText data-testid="external-account-management-outer">
                        {_t(
                            "settings|general|external_account_management",
                            { hostname },
                            { code: (sub) => <code>{sub}</code> },
                        )}
                    </SettingsSubsectionText>
                    <AccessibleButton
                        onClick={null}
                        element="a"
                        kind="primary"
                        target="_blank"
                        rel="noreferrer noopener"
                        href={this.state.externalAccountManagementUrl}
                        data-testid="external-account-management-link"
                    >
                        {_t("settings|general|oidc_manage_button")}
                    </AccessibleButton>
                </>
            );
        }
        return (
            <>
                <SettingsSubsection
                    heading={_t("settings|general|account_section")}
                    stretchContent
                    data-testid="accountSection"
                >
                    {externalAccountManagement}
                    {passwordChangeSection}
                </SettingsSubsection>
            </>
        );
    }

    private renderLanguageSection(): JSX.Element {
        // TODO: Convert to new-styled Field
        return (
            <SettingsSubsection heading={_t("settings|general|language_section")} stretchContent>
                <LanguageDropdown
                    className="mx_GeneralUserSettingsTab_section_languageInput"
                    onOptionChange={this.onLanguageChange}
                    value={this.state.language}
                />
            </SettingsSubsection>
        );
    }

    private renderSpellCheckSection(): JSX.Element {
        const heading = (
            <SettingsSubsectionHeading heading={_t("settings|general|spell_check_section")}>
                <ToggleSwitch checked={!!this.state.spellCheckEnabled} onChange={this.onSpellCheckEnabledChange} />
            </SettingsSubsectionHeading>
        );
        return (
            <SettingsSubsection heading={heading} stretchContent>
                {this.state.spellCheckEnabled && !IS_MAC && (
                    <SpellCheckSettings
                        languages={this.state.spellCheckLanguages}
                        onLanguagesChange={this.onSpellCheckLanguagesChange}
                    />
                )}
            </SettingsSubsection>
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

    private renderIntegrationManagerSection(): ReactNode {
        if (!SettingsStore.getValue(UIFeature.Widgets)) return null;

        return <SetIntegrationManager />;
    }

    public render(): React.ReactNode {
        const plaf = PlatformPeg.get();
        const supportsMultiLanguageSpellCheck = plaf?.supportsSpellCheckSettings();

        let accountManagementSection: JSX.Element | undefined;
        const isAccountManagedExternally = !!this.state.externalAccountManagementUrl;
        if (SettingsStore.getValue(UIFeature.Deactivate) && !isAccountManagedExternally) {
            accountManagementSection = this.renderManagementSection();
        }

        return (
            <SettingsTab data-testid="mx_GeneralUserSettingsTab">
                <SettingsSection>
                    <UserProfileSettings />
                    <UserPersonalInfoSettings canMake3pidChanges={this.state.canMake3pidChanges} />
                    {this.renderAccountSection()}
                    {this.renderLanguageSection()}
                    {supportsMultiLanguageSpellCheck ? this.renderSpellCheckSection() : null}
                </SettingsSection>
                {this.renderIntegrationManagerSection()}
                {accountManagementSection}
            </SettingsTab>
        );
    }
}
