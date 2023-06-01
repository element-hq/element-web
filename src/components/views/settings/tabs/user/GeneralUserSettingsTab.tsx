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
import { SERVICE_TYPES } from "matrix-js-sdk/src/service-types";
import { IThreepid, ThreepidMedium } from "matrix-js-sdk/src/@types/threepids";
import { logger } from "matrix-js-sdk/src/logger";
import { IDelegatedAuthConfig, M_AUTHENTICATION } from "matrix-js-sdk/src/matrix";
import { HTTPError } from "matrix-js-sdk/src/matrix";

import { Icon as WarningIcon } from "../../../../../../res/img/feather-customised/warning-triangle.svg";
import { UserFriendlyError, _t } from "../../../../../languageHandler";
import ProfileSettings from "../../ProfileSettings";
import * as languageHandler from "../../../../../languageHandler";
import SettingsStore from "../../../../../settings/SettingsStore";
import LanguageDropdown from "../../../elements/LanguageDropdown";
import SpellCheckSettings from "../../SpellCheckSettings";
import AccessibleButton from "../../../elements/AccessibleButton";
import DeactivateAccountDialog from "../../../dialogs/DeactivateAccountDialog";
import PlatformPeg from "../../../../../PlatformPeg";
import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import Modal from "../../../../../Modal";
import dis from "../../../../../dispatcher/dispatcher";
import { Service, ServicePolicyPair, startTermsFlow } from "../../../../../Terms";
import IdentityAuthClient from "../../../../../IdentityAuthClient";
import { abbreviateUrl } from "../../../../../utils/UrlUtils";
import { getThreepidsWithBindStatus } from "../../../../../boundThreepids";
import Spinner from "../../../elements/Spinner";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import { UIFeature } from "../../../../../settings/UIFeature";
import { ActionPayload } from "../../../../../dispatcher/payloads";
import ErrorDialog, { extractErrorMessageFromError } from "../../../dialogs/ErrorDialog";
import AccountPhoneNumbers from "../../account/PhoneNumbers";
import AccountEmailAddresses from "../../account/EmailAddresses";
import DiscoveryEmailAddresses from "../../discovery/EmailAddresses";
import DiscoveryPhoneNumbers from "../../discovery/PhoneNumbers";
import ChangePassword from "../../ChangePassword";
import InlineTermsAgreement from "../../../terms/InlineTermsAgreement";
import SetIdServer from "../../SetIdServer";
import SetIntegrationManager from "../../SetIntegrationManager";
import ToggleSwitch from "../../../elements/ToggleSwitch";
import { IS_MAC } from "../../../../../Keyboard";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import SettingsSubsection, { SettingsSubsectionText } from "../../shared/SettingsSubsection";
import { SettingsSubsectionHeading } from "../../shared/SettingsSubsectionHeading";
import Heading from "../../../typography/Heading";
import InlineSpinner from "../../../elements/InlineSpinner";
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";

interface IProps {
    closeSettingsFn: () => void;
}

interface IState {
    language: string;
    spellCheckEnabled?: boolean;
    spellCheckLanguages: string[];
    haveIdServer: boolean;
    serverSupportsSeparateAddAndBind?: boolean;
    idServerHasUnsignedTerms: boolean;
    requiredPolicyInfo:
        | {
              // This object is passed along to a component for handling
              hasTerms: false;
              policiesAndServices: null; // From the startTermsFlow callback
              agreedUrls: null; // From the startTermsFlow callback
              resolve: null; // Promise resolve function for startTermsFlow callback
          }
        | {
              hasTerms: boolean;
              policiesAndServices: ServicePolicyPair[];
              agreedUrls: string[];
              resolve: (values: string[]) => void;
          };
    emails: IThreepid[];
    msisdns: IThreepid[];
    loading3pids: boolean; // whether or not the emails and msisdns have been loaded
    canChangePassword: boolean;
    idServerName?: string;
    externalAccountManagementUrl?: string;
}

export default class GeneralUserSettingsTab extends React.Component<IProps, IState> {
    public static contextType = MatrixClientContext;
    public context!: React.ContextType<typeof MatrixClientContext>;

    private readonly dispatcherRef: string;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            language: languageHandler.getCurrentLanguage(),
            spellCheckEnabled: false,
            spellCheckLanguages: [],
            haveIdServer: Boolean(MatrixClientPeg.get().getIdentityServerUrl()),
            idServerHasUnsignedTerms: false,
            requiredPolicyInfo: {
                // This object is passed along to a component for handling
                hasTerms: false,
                policiesAndServices: null, // From the startTermsFlow callback
                agreedUrls: null, // From the startTermsFlow callback
                resolve: null, // Promise resolve function for startTermsFlow callback
            },
            emails: [],
            msisdns: [],
            loading3pids: true, // whether or not the emails and msisdns have been loaded
            canChangePassword: false,
        };

        this.dispatcherRef = dis.register(this.onAction);

        this.getCapabilities();
        this.getThreepidState();
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

    public componentWillUnmount(): void {
        dis.unregister(this.dispatcherRef);
    }

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === "id_server_changed") {
            this.setState({ haveIdServer: Boolean(MatrixClientPeg.get().getIdentityServerUrl()) });
            this.getThreepidState();
        }
    };

    private onEmailsChange = (emails: IThreepid[]): void => {
        this.setState({ emails });
    };

    private onMsisdnsChange = (msisdns: IThreepid[]): void => {
        this.setState({ msisdns });
    };

    private async getCapabilities(): Promise<void> {
        const cli = MatrixClientPeg.get();

        const serverSupportsSeparateAddAndBind = await cli.doesServerSupportSeparateAddAndBind();

        const capabilities = await cli.getCapabilities(); // this is cached
        const changePasswordCap = capabilities["m.change_password"];

        // You can change your password so long as the capability isn't explicitly disabled. The implicit
        // behaviour is you can change your password when the capability is missing or has not-false as
        // the enabled flag value.
        const canChangePassword = !changePasswordCap || changePasswordCap["enabled"] !== false;

        const delegatedAuthConfig = M_AUTHENTICATION.findIn<IDelegatedAuthConfig | undefined>(cli.getClientWellKnown());
        const externalAccountManagementUrl = delegatedAuthConfig?.account;

        this.setState({ serverSupportsSeparateAddAndBind, canChangePassword, externalAccountManagementUrl });
    }

    private async getThreepidState(): Promise<void> {
        const cli = MatrixClientPeg.get();

        // Check to see if terms need accepting
        this.checkTerms();

        // Need to get 3PIDs generally for Account section and possibly also for
        // Discovery (assuming we have an IS and terms are agreed).
        let threepids: IThreepid[] = [];
        try {
            threepids = await getThreepidsWithBindStatus(cli);
        } catch (e) {
            const idServerUrl = MatrixClientPeg.get().getIdentityServerUrl();
            logger.warn(
                `Unable to reach identity server at ${idServerUrl} to check ` + `for 3PIDs bindings in Settings`,
            );
            logger.warn(e);
        }
        this.setState({
            emails: threepids.filter((a) => a.medium === ThreepidMedium.Email),
            msisdns: threepids.filter((a) => a.medium === ThreepidMedium.Phone),
            loading3pids: false,
        });
    }

    private async checkTerms(): Promise<void> {
        // By starting the terms flow we get the logic for checking which terms the user has signed
        // for free. So we might as well use that for our own purposes.
        const idServerUrl = MatrixClientPeg.get().getIdentityServerUrl();
        if (!this.state.haveIdServer || !idServerUrl) {
            this.setState({ idServerHasUnsignedTerms: false });
            return;
        }

        const authClient = new IdentityAuthClient();
        try {
            const idAccessToken = await authClient.getAccessToken({ check: false });
            await startTermsFlow(
                this.context,
                [new Service(SERVICE_TYPES.IS, idServerUrl, idAccessToken!)],
                (policiesAndServices, agreedUrls, extraClassNames) => {
                    return new Promise((resolve, reject) => {
                        this.setState({
                            idServerName: abbreviateUrl(idServerUrl),
                            requiredPolicyInfo: {
                                hasTerms: true,
                                policiesAndServices,
                                agreedUrls,
                                resolve,
                            },
                        });
                    });
                },
            );
            // User accepted all terms
            this.setState({
                requiredPolicyInfo: {
                    ...this.state.requiredPolicyInfo, // set first so we can override
                    hasTerms: false,
                },
            });
        } catch (e) {
            logger.warn(`Unable to reach identity server at ${idServerUrl} to check ` + `for terms in Settings`);
            logger.warn(e);
        }
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
            _t("Unknown password change error (%(stringifiedError)s)", {
                stringifiedError: String(err),
            }),
        );

        let errorMessageToDisplay = errorMessage;
        if (underlyingError instanceof HTTPError && underlyingError.httpStatus === 403) {
            errorMessageToDisplay = _t("Failed to change password. Is your password correct?");
        } else if (underlyingError instanceof HTTPError) {
            errorMessageToDisplay = _t("%(errorMessage)s (HTTP status %(httpStatus)s)", {
                errorMessage,
                httpStatus: underlyingError.httpStatus,
            });
        }

        // TODO: Figure out a design that doesn't involve replacing the current dialog
        Modal.createDialog(ErrorDialog, {
            title: _t("Error changing password"),
            description: errorMessageToDisplay,
        });
    };

    private onPasswordChanged = ({ didLogoutOutOtherDevices }: { didLogoutOutOtherDevices: boolean }): void => {
        let description = _t("Your password was successfully changed.");
        if (didLogoutOutOtherDevices) {
            description +=
                " " + _t("You will not receive push notifications on other devices until you sign back in to them.");
        }
        // TODO: Figure out a design that doesn't involve replacing the current dialog
        Modal.createDialog(ErrorDialog, {
            title: _t("Success"),
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
        let threepidSection: ReactNode = null;

        // For older homeservers without separate 3PID add and bind methods (MSC2290),
        // we use a combo add with bind option API which requires an identity server to
        // validate 3PID ownership even if we're just adding to the homeserver only.
        // For newer homeservers with separate 3PID add and bind methods (MSC2290),
        // there is no such concern, so we can always show the HS account 3PIDs.
        if (
            SettingsStore.getValue(UIFeature.ThirdPartyID) &&
            (this.state.haveIdServer || this.state.serverSupportsSeparateAddAndBind === true)
        ) {
            const emails = this.state.loading3pids ? (
                <InlineSpinner />
            ) : (
                <AccountEmailAddresses emails={this.state.emails} onEmailsChange={this.onEmailsChange} />
            );
            const msisdns = this.state.loading3pids ? (
                <InlineSpinner />
            ) : (
                <AccountPhoneNumbers msisdns={this.state.msisdns} onMsisdnsChange={this.onMsisdnsChange} />
            );
            threepidSection = (
                <>
                    <SettingsSubsection
                        heading={_t("Email addresses")}
                        stretchContent
                        data-testid="mx_AccountEmailAddresses"
                    >
                        {emails}
                    </SettingsSubsection>

                    <SettingsSubsection
                        heading={_t("Phone numbers")}
                        stretchContent
                        data-testid="mx_AccountPhoneNumbers"
                    >
                        {msisdns}
                    </SettingsSubsection>
                </>
            );
        } else if (this.state.serverSupportsSeparateAddAndBind === null) {
            threepidSection = <Spinner />;
        }

        let passwordChangeSection: ReactNode = null;
        if (this.state.canChangePassword) {
            passwordChangeSection = (
                <>
                    <SettingsSubsectionText>{_t("Set a new account password…")}</SettingsSubsectionText>
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
                            "Your account details are managed separately at <code>%(hostname)s</code>.",
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
                        {_t("Manage account")}
                    </AccessibleButton>
                </>
            );
        }
        return (
            <>
                <SettingsSubsection heading={_t("Account")} stretchContent data-testid="accountSection">
                    {externalAccountManagement}
                    {passwordChangeSection}
                </SettingsSubsection>
                {threepidSection}
            </>
        );
    }

    private renderLanguageSection(): JSX.Element {
        // TODO: Convert to new-styled Field
        return (
            <SettingsSubsection heading={_t("Language and region")} stretchContent>
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
            <SettingsSubsectionHeading heading={_t("Spell check")}>
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

    private renderDiscoverySection(): JSX.Element {
        if (this.state.requiredPolicyInfo.hasTerms) {
            const intro = (
                <SettingsSubsectionText>
                    {_t(
                        "Agree to the identity server (%(serverName)s) Terms of Service to " +
                            "allow yourself to be discoverable by email address or phone number.",
                        { serverName: this.state.idServerName },
                    )}
                </SettingsSubsectionText>
            );
            return (
                <>
                    <InlineTermsAgreement
                        policiesAndServicePairs={this.state.requiredPolicyInfo.policiesAndServices}
                        agreedUrls={this.state.requiredPolicyInfo.agreedUrls}
                        onFinished={this.state.requiredPolicyInfo.resolve}
                        introElement={intro}
                    />
                    {/* has its own heading as it includes the current identity server */}
                    <SetIdServer missingTerms={true} />
                </>
            );
        }

        const threepidSection = this.state.haveIdServer ? (
            <>
                <DiscoveryEmailAddresses emails={this.state.emails} isLoading={this.state.loading3pids} />
                <DiscoveryPhoneNumbers msisdns={this.state.msisdns} isLoading={this.state.loading3pids} />
            </>
        ) : null;

        return (
            <>
                {threepidSection}
                {/* has its own heading as it includes the current identity server */}
                <SetIdServer missingTerms={false} />
            </>
        );
    }

    private renderManagementSection(): JSX.Element {
        // TODO: Improve warning text for account deactivation
        return (
            <SettingsSection heading={_t("Deactivate account")}>
                <SettingsSubsection
                    heading={_t("Account management")}
                    data-testid="account-management-section"
                    description={_t("Deactivating your account is a permanent action — be careful!")}
                >
                    <AccessibleButton onClick={this.onDeactivateClicked} kind="danger">
                        {_t("Deactivate Account")}
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
        if (SettingsStore.getValue(UIFeature.Deactivate)) {
            accountManagementSection = this.renderManagementSection();
        }

        let discoverySection;
        if (SettingsStore.getValue(UIFeature.IdentityServer)) {
            const discoWarning = this.state.requiredPolicyInfo.hasTerms ? (
                <WarningIcon
                    className="mx_GeneralUserSettingsTab_warningIcon"
                    width="18"
                    height="18"
                    // override icon default values
                    aria-hidden={false}
                    aria-label={_t("Warning")}
                />
            ) : null;
            const heading = (
                <Heading size="h2">
                    {discoWarning}
                    {_t("Discovery")}
                </Heading>
            );
            discoverySection = (
                <SettingsSection heading={heading} data-testid="discoverySection">
                    {this.renderDiscoverySection()}
                </SettingsSection>
            );
        }

        return (
            <SettingsTab data-testid="mx_GeneralUserSettingsTab">
                <SettingsSection heading={_t("General")}>
                    <ProfileSettings />
                    {this.renderAccountSection()}
                    {this.renderLanguageSection()}
                    {supportsMultiLanguageSpellCheck ? this.renderSpellCheckSection() : null}
                </SettingsSection>
                {discoverySection}
                {this.renderIntegrationManagerSection()}
                {accountManagementSection}
            </SettingsTab>
        );
    }
}
