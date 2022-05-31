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

import React from 'react';
import { SERVICE_TYPES } from "matrix-js-sdk/src/service-types";
import { IThreepid } from "matrix-js-sdk/src/@types/threepids";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../../languageHandler";
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
import { Policies, Service, startTermsFlow } from "../../../../../Terms";
import IdentityAuthClient from "../../../../../IdentityAuthClient";
import { abbreviateUrl } from "../../../../../utils/UrlUtils";
import { getThreepidsWithBindStatus } from '../../../../../boundThreepids';
import Spinner from "../../../elements/Spinner";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import { UIFeature } from "../../../../../settings/UIFeature";
import { ActionPayload } from "../../../../../dispatcher/payloads";
import ErrorDialog from "../../../dialogs/ErrorDialog";
import AccountPhoneNumbers from "../../account/PhoneNumbers";
import AccountEmailAddresses from "../../account/EmailAddresses";
import DiscoveryEmailAddresses from "../../discovery/EmailAddresses";
import DiscoveryPhoneNumbers from "../../discovery/PhoneNumbers";
import ChangePassword from "../../ChangePassword";
import InlineTermsAgreement from "../../../terms/InlineTermsAgreement";
import SetIdServer from "../../SetIdServer";
import SetIntegrationManager from "../../SetIntegrationManager";

interface IProps {
    closeSettingsFn: () => void;
}

interface IState {
    language: string;
    spellCheckLanguages: string[];
    haveIdServer: boolean;
    serverSupportsSeparateAddAndBind: boolean;
    idServerHasUnsignedTerms: boolean;
    requiredPolicyInfo: {       // This object is passed along to a component for handling
        hasTerms: boolean;
        policiesAndServices: {
            service: Service;
            policies: Policies;
        }[]; // From the startTermsFlow callback
        agreedUrls: string[]; // From the startTermsFlow callback
        resolve: (values: string[]) => void; // Promise resolve function for startTermsFlow callback
    };
    emails: IThreepid[];
    msisdns: IThreepid[];
    loading3pids: boolean; // whether or not the emails and msisdns have been loaded
    canChangePassword: boolean;
    idServerName: string;
}

export default class GeneralUserSettingsTab extends React.Component<IProps, IState> {
    private readonly dispatcherRef: string;

    constructor(props: IProps) {
        super(props);

        this.state = {
            language: languageHandler.getCurrentLanguage(),
            spellCheckLanguages: [],
            haveIdServer: Boolean(MatrixClientPeg.get().getIdentityServerUrl()),
            serverSupportsSeparateAddAndBind: null,
            idServerHasUnsignedTerms: false,
            requiredPolicyInfo: {       // This object is passed along to a component for handling
                hasTerms: false,
                policiesAndServices: null, // From the startTermsFlow callback
                agreedUrls: null,          // From the startTermsFlow callback
                resolve: null,             // Promise resolve function for startTermsFlow callback
            },
            emails: [],
            msisdns: [],
            loading3pids: true, // whether or not the emails and msisdns have been loaded
            canChangePassword: false,
            idServerName: null,
        };

        this.dispatcherRef = dis.register(this.onAction);
    }

    // TODO: [REACT-WARNING] Move this to constructor
    // eslint-disable-next-line @typescript-eslint/naming-convention, camelcase
    public async UNSAFE_componentWillMount(): Promise<void> {
        const cli = MatrixClientPeg.get();

        const serverSupportsSeparateAddAndBind = await cli.doesServerSupportSeparateAddAndBind();

        const capabilities = await cli.getCapabilities(); // this is cached
        const changePasswordCap = capabilities['m.change_password'];

        // You can change your password so long as the capability isn't explicitly disabled. The implicit
        // behaviour is you can change your password when the capability is missing or has not-false as
        // the enabled flag value.
        const canChangePassword = !changePasswordCap || changePasswordCap['enabled'] !== false;

        this.setState({ serverSupportsSeparateAddAndBind, canChangePassword });

        this.getThreepidState();
    }

    public async componentDidMount(): Promise<void> {
        const plaf = PlatformPeg.get();
        if (plaf) {
            this.setState({
                spellCheckLanguages: await plaf.getSpellCheckLanguages(),
            });
        }
    }

    public componentWillUnmount(): void {
        dis.unregister(this.dispatcherRef);
    }

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === 'id_server_changed') {
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

    private async getThreepidState(): Promise<void> {
        const cli = MatrixClientPeg.get();

        // Check to see if terms need accepting
        this.checkTerms();

        // Need to get 3PIDs generally for Account section and possibly also for
        // Discovery (assuming we have an IS and terms are agreed).
        let threepids = [];
        try {
            threepids = await getThreepidsWithBindStatus(cli);
        } catch (e) {
            const idServerUrl = MatrixClientPeg.get().getIdentityServerUrl();
            logger.warn(
                `Unable to reach identity server at ${idServerUrl} to check ` +
                `for 3PIDs bindings in Settings`,
            );
            logger.warn(e);
        }
        this.setState({
            emails: threepids.filter((a) => a.medium === 'email'),
            msisdns: threepids.filter((a) => a.medium === 'msisdn'),
            loading3pids: false,
        });
    }

    private async checkTerms(): Promise<void> {
        if (!this.state.haveIdServer) {
            this.setState({ idServerHasUnsignedTerms: false });
            return;
        }

        // By starting the terms flow we get the logic for checking which terms the user has signed
        // for free. So we might as well use that for our own purposes.
        const idServerUrl = MatrixClientPeg.get().getIdentityServerUrl();
        const authClient = new IdentityAuthClient();
        try {
            const idAccessToken = await authClient.getAccessToken({ check: false });
            await startTermsFlow([new Service(
                SERVICE_TYPES.IS,
                idServerUrl,
                idAccessToken,
            )], (policiesAndServices, agreedUrls, extraClassNames) => {
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
            });
            // User accepted all terms
            this.setState({
                requiredPolicyInfo: {
                    ...this.state.requiredPolicyInfo, // set first so we can override
                    hasTerms: false,
                },
            });
        } catch (e) {
            logger.warn(
                `Unable to reach identity server at ${idServerUrl} to check ` +
                `for terms in Settings`,
            );
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

        const plaf = PlatformPeg.get();
        if (plaf) {
            plaf.setSpellCheckLanguages(languages);
        }
    };

    private onPasswordChangeError = (err): void => {
        // TODO: Figure out a design that doesn't involve replacing the current dialog
        let errMsg = err.error || err.message || "";
        if (err.httpStatus === 403) {
            errMsg = _t("Failed to change password. Is your password correct?");
        } else if (!errMsg) {
            errMsg += ` (HTTP status ${err.httpStatus})`;
        }
        logger.error("Failed to change password: " + errMsg);
        Modal.createTrackedDialog('Failed to change password', '', ErrorDialog, {
            title: _t("Error"),
            description: errMsg,
        });
    };

    private onPasswordChanged = ({ didLogoutOutOtherDevices }: { didLogoutOutOtherDevices: boolean }): void => {
        let description = _t("Your password was successfully changed.");
        if (didLogoutOutOtherDevices) {
            description += " " + _t(
                "You will not receive push notifications on other devices until you sign back in to them.",
            );
        }
        // TODO: Figure out a design that doesn't involve replacing the current dialog
        Modal.createTrackedDialog('Password changed', '', ErrorDialog, {
            title: _t("Success"),
            description,
        });
    };

    private onDeactivateClicked = (): void => {
        Modal.createTrackedDialog('Deactivate Account', '', DeactivateAccountDialog, {
            onFinished: (success) => {
                if (success) this.props.closeSettingsFn();
            },
        });
    };

    private renderProfileSection(): JSX.Element {
        return (
            <div className="mx_SettingsTab_section">
                <ProfileSettings />
            </div>
        );
    }

    private renderAccountSection(): JSX.Element {
        let passwordChangeForm = (
            <ChangePassword
                className="mx_GeneralUserSettingsTab_changePassword"
                rowClassName=""
                buttonKind="primary"
                onError={this.onPasswordChangeError}
                onFinished={this.onPasswordChanged} />
        );

        let threepidSection = null;

        // For older homeservers without separate 3PID add and bind methods (MSC2290),
        // we use a combo add with bind option API which requires an identity server to
        // validate 3PID ownership even if we're just adding to the homeserver only.
        // For newer homeservers with separate 3PID add and bind methods (MSC2290),
        // there is no such concern, so we can always show the HS account 3PIDs.
        if (SettingsStore.getValue(UIFeature.ThirdPartyID) &&
            (this.state.haveIdServer || this.state.serverSupportsSeparateAddAndBind === true)
        ) {
            const emails = this.state.loading3pids
                ? <Spinner />
                : <AccountEmailAddresses
                    emails={this.state.emails}
                    onEmailsChange={this.onEmailsChange}
                />;
            const msisdns = this.state.loading3pids
                ? <Spinner />
                : <AccountPhoneNumbers
                    msisdns={this.state.msisdns}
                    onMsisdnsChange={this.onMsisdnsChange}
                />;
            threepidSection = <div>
                <span className="mx_SettingsTab_subheading">{ _t("Email addresses") }</span>
                { emails }

                <span className="mx_SettingsTab_subheading">{ _t("Phone numbers") }</span>
                { msisdns }
            </div>;
        } else if (this.state.serverSupportsSeparateAddAndBind === null) {
            threepidSection = <Spinner />;
        }

        let passwordChangeText = _t("Set a new account password...");
        if (!this.state.canChangePassword) {
            // Just don't show anything if you can't do anything.
            passwordChangeText = null;
            passwordChangeForm = null;
        }

        return (
            <div className="mx_SettingsTab_section mx_GeneralUserSettingsTab_accountSection">
                <span className="mx_SettingsTab_subheading">{ _t("Account") }</span>
                <p className="mx_SettingsTab_subsectionText">
                    { passwordChangeText }
                </p>
                { passwordChangeForm }
                { threepidSection }
            </div>
        );
    }

    private renderLanguageSection(): JSX.Element {
        // TODO: Convert to new-styled Field
        return (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{ _t("Language and region") }</span>
                <LanguageDropdown
                    className="mx_GeneralUserSettingsTab_languageInput"
                    onOptionChange={this.onLanguageChange}
                    value={this.state.language}
                />
            </div>
        );
    }

    private renderSpellCheckSection(): JSX.Element {
        return (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{ _t("Spell check dictionaries") }</span>
                <SpellCheckSettings
                    languages={this.state.spellCheckLanguages}
                    onLanguagesChange={this.onSpellCheckLanguagesChange}
                />
            </div>
        );
    }

    private renderDiscoverySection(): JSX.Element {
        if (this.state.requiredPolicyInfo.hasTerms) {
            const intro = <span className="mx_SettingsTab_subsectionText">
                { _t(
                    "Agree to the identity server (%(serverName)s) Terms of Service to " +
                    "allow yourself to be discoverable by email address or phone number.",
                    { serverName: this.state.idServerName },
                ) }
            </span>;
            return (
                <div>
                    <InlineTermsAgreement
                        policiesAndServicePairs={this.state.requiredPolicyInfo.policiesAndServices}
                        agreedUrls={this.state.requiredPolicyInfo.agreedUrls}
                        onFinished={this.state.requiredPolicyInfo.resolve}
                        introElement={intro}
                    />
                    { /* has its own heading as it includes the current identity server */ }
                    <SetIdServer missingTerms={true} />
                </div>
            );
        }

        const emails = this.state.loading3pids ? <Spinner /> : <DiscoveryEmailAddresses emails={this.state.emails} />;
        const msisdns = this.state.loading3pids ? <Spinner /> : <DiscoveryPhoneNumbers msisdns={this.state.msisdns} />;

        const threepidSection = this.state.haveIdServer ? <div className='mx_GeneralUserSettingsTab_discovery'>
            <span className="mx_SettingsTab_subheading">{ _t("Email addresses") }</span>
            { emails }

            <span className="mx_SettingsTab_subheading">{ _t("Phone numbers") }</span>
            { msisdns }
        </div> : null;

        return (
            <div className="mx_SettingsTab_section">
                { threepidSection }
                { /* has its own heading as it includes the current identity server */ }
                <SetIdServer missingTerms={false} />
            </div>
        );
    }

    private renderManagementSection(): JSX.Element {
        // TODO: Improve warning text for account deactivation
        return (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{ _t("Account management") }</span>
                <span className="mx_SettingsTab_subsectionText">
                    { _t("Deactivating your account is a permanent action — be careful!") }
                </span>
                <AccessibleButton onClick={this.onDeactivateClicked} kind="danger">
                    { _t("Deactivate Account") }
                </AccessibleButton>
            </div>
        );
    }

    private renderIntegrationManagerSection(): JSX.Element {
        if (!SettingsStore.getValue(UIFeature.Widgets)) return null;

        return (
            <div className="mx_SettingsTab_section">
                { /* has its own heading as it includes the current integration manager */ }
                <SetIntegrationManager />
            </div>
        );
    }

    public render(): JSX.Element {
        const plaf = PlatformPeg.get();
        const supportsMultiLanguageSpellCheck = plaf.supportsMultiLanguageSpellCheck();

        const discoWarning = this.state.requiredPolicyInfo.hasTerms
            ? <img
                className='mx_GeneralUserSettingsTab_warningIcon'
                src={require("../../../../../../res/img/feather-customised/warning-triangle.svg").default}
                width="18"
                height="18"
                alt={_t("Warning")}
            />
            : null;

        let accountManagementSection;
        if (SettingsStore.getValue(UIFeature.Deactivate)) {
            accountManagementSection = <>
                <div className="mx_SettingsTab_heading">{ _t("Deactivate account") }</div>
                { this.renderManagementSection() }
            </>;
        }

        let discoverySection;
        if (SettingsStore.getValue(UIFeature.IdentityServer)) {
            discoverySection = <>
                <div className="mx_SettingsTab_heading">{ discoWarning } { _t("Discovery") }</div>
                { this.renderDiscoverySection() }
            </>;
        }

        return (
            <div className="mx_SettingsTab">
                <div className="mx_SettingsTab_heading">{ _t("General") }</div>
                { this.renderProfileSection() }
                { this.renderAccountSection() }
                { this.renderLanguageSection() }
                { supportsMultiLanguageSpellCheck ? this.renderSpellCheckSection() : null }
                { discoverySection }
                { this.renderIntegrationManagerSection() /* Has its own title */ }
                { accountManagementSection }
            </div>
        );
    }
}
