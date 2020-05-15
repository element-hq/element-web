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
import {_t} from "../../../../../languageHandler";
import ProfileSettings from "../../ProfileSettings";
import Field from "../../../elements/Field";
import * as languageHandler from "../../../../../languageHandler";
import {SettingLevel} from "../../../../../settings/SettingsStore";
import SettingsStore from "../../../../../settings/SettingsStore";
import LanguageDropdown from "../../../elements/LanguageDropdown";
import AccessibleButton from "../../../elements/AccessibleButton";
import DeactivateAccountDialog from "../../../dialogs/DeactivateAccountDialog";
import PropTypes from "prop-types";
import {enumerateThemes, ThemeWatcher} from "../../../../../theme";
import PlatformPeg from "../../../../../PlatformPeg";
import {MatrixClientPeg} from "../../../../../MatrixClientPeg";
import * as sdk from "../../../../..";
import Modal from "../../../../../Modal";
import dis from "../../../../../dispatcher/dispatcher";
import {Service, startTermsFlow} from "../../../../../Terms";
import {SERVICE_TYPES} from "matrix-js-sdk";
import IdentityAuthClient from "../../../../../IdentityAuthClient";
import {abbreviateUrl} from "../../../../../utils/UrlUtils";
import { getThreepidsWithBindStatus } from '../../../../../boundThreepids';
import Spinner from "../../../elements/Spinner";

export default class GeneralUserSettingsTab extends React.Component {
    static propTypes = {
        closeSettingsFn: PropTypes.func.isRequired,
    };

    constructor() {
        super();

        this.state = {
            language: languageHandler.getCurrentLanguage(),
            haveIdServer: Boolean(MatrixClientPeg.get().getIdentityServerUrl()),
            serverSupportsSeparateAddAndBind: null,
            idServerHasUnsignedTerms: false,
            requiredPolicyInfo: {       // This object is passed along to a component for handling
                hasTerms: false,
                // policiesAndServices, // From the startTermsFlow callback
                // agreedUrls,          // From the startTermsFlow callback
                // resolve,             // Promise resolve function for startTermsFlow callback
            },
            emails: [],
            msisdns: [],
            loading3pids: true, // whether or not the emails and msisdns have been loaded
            ...this._calculateThemeState(),
            customThemeUrl: "",
            customThemeMessage: {isError: false, text: ""},
        };

        this.dispatcherRef = dis.register(this._onAction);
    }

    // TODO: [REACT-WARNING] Move this to constructor
    async UNSAFE_componentWillMount() { // eslint-disable-line camelcase
        const cli = MatrixClientPeg.get();

        const serverSupportsSeparateAddAndBind = await cli.doesServerSupportSeparateAddAndBind();

        const capabilities = await cli.getCapabilities(); // this is cached
        const changePasswordCap = capabilities['m.change_password'];

        // You can change your password so long as the capability isn't explicitly disabled. The implicit
        // behaviour is you can change your password when the capability is missing or has not-false as
        // the enabled flag value.
        const canChangePassword = !changePasswordCap || changePasswordCap['enabled'] !== false;

        this.setState({serverSupportsSeparateAddAndBind, canChangePassword});

        this._getThreepidState();
    }

    componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
    }

    _calculateThemeState() {
        // We have to mirror the logic from ThemeWatcher.getEffectiveTheme so we
        // show the right values for things.

        const themeChoice = SettingsStore.getValueAt(SettingLevel.ACCOUNT, "theme");
        const systemThemeExplicit = SettingsStore.getValueAt(
            SettingLevel.DEVICE, "use_system_theme", null, false, true);
        const themeExplicit = SettingsStore.getValueAt(
            SettingLevel.DEVICE, "theme", null, false, true);

        // If the user has enabled system theme matching, use that.
        if (systemThemeExplicit) {
            return {
                theme: themeChoice,
                useSystemTheme: true,
            };
        }

        // If the user has set a theme explicitly, use that (no system theme matching)
        if (themeExplicit) {
            return {
                theme: themeChoice,
                useSystemTheme: false,
            };
        }

        // Otherwise assume the defaults for the settings
        return {
            theme: themeChoice,
            useSystemTheme: SettingsStore.getValueAt(SettingLevel.DEVICE, "use_system_theme"),
        };
    }

    _onAction = (payload) => {
        if (payload.action === 'id_server_changed') {
            this.setState({haveIdServer: Boolean(MatrixClientPeg.get().getIdentityServerUrl())});
            this._getThreepidState();
        }
    };

    _onEmailsChange = (emails) => {
        this.setState({ emails });
    };

    _onMsisdnsChange = (msisdns) => {
        this.setState({ msisdns });
    };

    async _getThreepidState() {
        const cli = MatrixClientPeg.get();

        // Check to see if terms need accepting
        this._checkTerms();

        // Need to get 3PIDs generally for Account section and possibly also for
        // Discovery (assuming we have an IS and terms are agreed).
        let threepids = [];
        try {
            threepids = await getThreepidsWithBindStatus(cli);
        } catch (e) {
            const idServerUrl = MatrixClientPeg.get().getIdentityServerUrl();
            console.warn(
                `Unable to reach identity server at ${idServerUrl} to check ` +
                `for 3PIDs bindings in Settings`,
            );
            console.warn(e);
        }
        this.setState({
            emails: threepids.filter((a) => a.medium === 'email'),
            msisdns: threepids.filter((a) => a.medium === 'msisdn'),
            loading3pids: false,
        });
    }

    async _checkTerms() {
        if (!this.state.haveIdServer) {
            this.setState({idServerHasUnsignedTerms: false});
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
                    hasTerms: false,
                },
            });
        } catch (e) {
            console.warn(
                `Unable to reach identity server at ${idServerUrl} to check ` +
                `for terms in Settings`,
            );
            console.warn(e);
        }
    }

    _onLanguageChange = (newLanguage) => {
        if (this.state.language === newLanguage) return;

        SettingsStore.setValue("language", null, SettingLevel.DEVICE, newLanguage);
        this.setState({language: newLanguage});
        PlatformPeg.get().reload();
    };

    _onThemeChange = (e) => {
        const newTheme = e.target.value;
        if (this.state.theme === newTheme) return;

        // doing getValue in the .catch will still return the value we failed to set,
        // so remember what the value was before we tried to set it so we can revert
        const oldTheme = SettingsStore.getValue('theme');
        SettingsStore.setValue("theme", null, SettingLevel.ACCOUNT, newTheme).catch(() => {
            dis.dispatch({action: 'recheck_theme'});
            this.setState({theme: oldTheme});
        });
        this.setState({theme: newTheme});
        // The settings watcher doesn't fire until the echo comes back from the
        // server, so to make the theme change immediately we need to manually
        // do the dispatch now
        // XXX: The local echoed value appears to be unreliable, in particular
        // when settings custom themes(!) so adding forceTheme to override
        // the value from settings.
        dis.dispatch({action: 'recheck_theme', forceTheme: newTheme});
    };

    _onUseSystemThemeChanged = (checked) => {
        this.setState({useSystemTheme: checked});
        SettingsStore.setValue("use_system_theme", null, SettingLevel.DEVICE, checked);
        dis.dispatch({action: 'recheck_theme'});
    };

    _onPasswordChangeError = (err) => {
        // TODO: Figure out a design that doesn't involve replacing the current dialog
        let errMsg = err.error || "";
        if (err.httpStatus === 403) {
            errMsg = _t("Failed to change password. Is your password correct?");
        } else if (err.httpStatus) {
            errMsg += ` (HTTP status ${err.httpStatus})`;
        }
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        console.error("Failed to change password: " + errMsg);
        Modal.createTrackedDialog('Failed to change password', '', ErrorDialog, {
            title: _t("Error"),
            description: errMsg,
        });
    };

    _onPasswordChanged = () => {
        // TODO: Figure out a design that doesn't involve replacing the current dialog
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        Modal.createTrackedDialog('Password changed', '', ErrorDialog, {
            title: _t("Success"),
            description: _t(
                "Your password was successfully changed. You will not receive " +
                "push notifications on other sessions until you log back in to them",
            ) + ".",
        });
    };

    _onDeactivateClicked = () => {
        Modal.createTrackedDialog('Deactivate Account', '', DeactivateAccountDialog, {
            onFinished: (success) => {
                if (success) this.props.closeSettingsFn();
            },
        });
    };

    _onAddCustomTheme = async () => {
        let currentThemes = SettingsStore.getValue("custom_themes");
        if (!currentThemes) currentThemes = [];
        currentThemes = currentThemes.map(c => c); // cheap clone

        if (this._themeTimer) {
            clearTimeout(this._themeTimer);
        }

        try {
            const r = await fetch(this.state.customThemeUrl);
            const themeInfo = await r.json();
            if (!themeInfo || typeof(themeInfo['name']) !== 'string' || typeof(themeInfo['colors']) !== 'object') {
                this.setState({customThemeMessage: {text: _t("Invalid theme schema."), isError: true}});
                return;
            }
            currentThemes.push(themeInfo);
        } catch (e) {
            console.error(e);
            this.setState({customThemeMessage: {text: _t("Error downloading theme information."), isError: true}});
            return; // Don't continue on error
        }

        await SettingsStore.setValue("custom_themes", null, SettingLevel.ACCOUNT, currentThemes);
        this.setState({customThemeUrl: "", customThemeMessage: {text: _t("Theme added!"), isError: false}});

        this._themeTimer = setTimeout(() => {
            this.setState({customThemeMessage: {text: "", isError: false}});
        }, 3000);
    };

    _onCustomThemeChange = (e) => {
        this.setState({customThemeUrl: e.target.value});
    };

    _renderProfileSection() {
        return (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{_t("Profile")}</span>
                <ProfileSettings />
            </div>
        );
    }

    _renderAccountSection() {
        const ChangePassword = sdk.getComponent("views.settings.ChangePassword");
        const EmailAddresses = sdk.getComponent("views.settings.account.EmailAddresses");
        const PhoneNumbers = sdk.getComponent("views.settings.account.PhoneNumbers");

        let passwordChangeForm = (
            <ChangePassword
                className="mx_GeneralUserSettingsTab_changePassword"
                rowClassName=""
                buttonKind="primary"
                onError={this._onPasswordChangeError}
                onFinished={this._onPasswordChanged} />
        );

        let threepidSection = null;

        // For older homeservers without separate 3PID add and bind methods (MSC2290),
        // we use a combo add with bind option API which requires an identity server to
        // validate 3PID ownership even if we're just adding to the homeserver only.
        // For newer homeservers with separate 3PID add and bind methods (MSC2290),
        // there is no such concern, so we can always show the HS account 3PIDs.
        if (this.state.haveIdServer || this.state.serverSupportsSeparateAddAndBind === true) {
            const emails = this.state.loading3pids
                ? <Spinner />
                : <EmailAddresses
                    emails={this.state.emails}
                    onEmailsChange={this._onEmailsChange}
                />;
            const msisdns = this.state.loading3pids
                ? <Spinner />
                : <PhoneNumbers
                    msisdns={this.state.msisdns}
                    onMsisdnsChange={this._onMsisdnsChange}
                />;
            threepidSection = <div>
                <span className="mx_SettingsTab_subheading">{_t("Email addresses")}</span>
                {emails}

                <span className="mx_SettingsTab_subheading">{_t("Phone numbers")}</span>
                {msisdns}
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
                <span className="mx_SettingsTab_subheading">{_t("Account")}</span>
                <p className="mx_SettingsTab_subsectionText">
                    {passwordChangeText}
                </p>
                {passwordChangeForm}
                {threepidSection}
            </div>
        );
    }

    _renderLanguageSection() {
        // TODO: Convert to new-styled Field
        return (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{_t("Language and region")}</span>
                <LanguageDropdown className="mx_GeneralUserSettingsTab_languageInput"
                                  onOptionChange={this._onLanguageChange} value={this.state.language} />
            </div>
        );
    }

    _renderThemeSection() {
        const SettingsFlag = sdk.getComponent("views.elements.SettingsFlag");
        const LabelledToggleSwitch = sdk.getComponent("views.elements.LabelledToggleSwitch");

        const themeWatcher = new ThemeWatcher();
        let systemThemeSection;
        if (themeWatcher.isSystemThemeSupported()) {
            systemThemeSection = <div>
                <LabelledToggleSwitch
                    value={this.state.useSystemTheme}
                    label={SettingsStore.getDisplayName("use_system_theme")}
                    onChange={this._onUseSystemThemeChanged}
                />
            </div>;
        }

        let customThemeForm;
        if (SettingsStore.isFeatureEnabled("feature_custom_themes")) {
            let messageElement = null;
            if (this.state.customThemeMessage.text) {
                if (this.state.customThemeMessage.isError) {
                    messageElement = <div className='text-error'>{this.state.customThemeMessage.text}</div>;
                } else {
                    messageElement = <div className='text-success'>{this.state.customThemeMessage.text}</div>;
                }
            }
            customThemeForm = (
                <div className='mx_SettingsTab_section'>
                    <form onSubmit={this._onAddCustomTheme}>
                        <Field
                            label={_t("Custom theme URL")}
                            type='text'
                            autoComplete="off"
                            onChange={this._onCustomThemeChange}
                            value={this.state.customThemeUrl}
                        />
                        <AccessibleButton
                            onClick={this._onAddCustomTheme}
                            type="submit" kind="primary_sm"
                            disabled={!this.state.customThemeUrl.trim()}
                        >{_t("Add theme")}</AccessibleButton>
                        {messageElement}
                    </form>
                </div>
            );
        }

        const themes = Object.entries(enumerateThemes())
            .map(p => ({id: p[0], name: p[1]})); // convert pairs to objects for code readability
        const builtInThemes = themes.filter(p => !p.id.startsWith("custom-"));
        const customThemes = themes.filter(p => !builtInThemes.includes(p))
            .sort((a, b) => a.name.localeCompare(b.name));
        const orderedThemes = [...builtInThemes, ...customThemes];
        return (
            <div className="mx_SettingsTab_section mx_GeneralUserSettingsTab_themeSection">
                <span className="mx_SettingsTab_subheading">{_t("Theme")}</span>
                {systemThemeSection}
                <Field label={_t("Theme")} element="select"
                       value={this.state.theme} onChange={this._onThemeChange}
                       disabled={this.state.useSystemTheme}
                >
                    {orderedThemes.map(theme => {
                        return <option key={theme.id} value={theme.id}>{theme.name}</option>;
                    })}
                </Field>
                {customThemeForm}
                <SettingsFlag name="useCompactLayout" level={SettingLevel.ACCOUNT} />
            </div>
        );
    }

    _renderDiscoverySection() {
        const SetIdServer = sdk.getComponent("views.settings.SetIdServer");

        if (this.state.requiredPolicyInfo.hasTerms) {
            const InlineTermsAgreement = sdk.getComponent("views.terms.InlineTermsAgreement");
            const intro = <span className="mx_SettingsTab_subsectionText">
                {_t(
                    "Agree to the identity server (%(serverName)s) Terms of Service to " +
                    "allow yourself to be discoverable by email address or phone number.",
                    {serverName: this.state.idServerName},
                )}
            </span>;
            return (
                <div>
                    <InlineTermsAgreement
                        policiesAndServicePairs={this.state.requiredPolicyInfo.policiesAndServices}
                        agreedUrls={this.state.requiredPolicyInfo.agreedUrls}
                        onFinished={this.state.requiredPolicyInfo.resolve}
                        introElement={intro}
                    />
                    { /* has its own heading as it includes the current ID server */ }
                    <SetIdServer missingTerms={true} />
                </div>
            );
        }

        const EmailAddresses = sdk.getComponent("views.settings.discovery.EmailAddresses");
        const PhoneNumbers = sdk.getComponent("views.settings.discovery.PhoneNumbers");

        const emails = this.state.loading3pids ? <Spinner /> : <EmailAddresses emails={this.state.emails} />;
        const msisdns = this.state.loading3pids ? <Spinner /> : <PhoneNumbers msisdns={this.state.msisdns} />;

        const threepidSection = this.state.haveIdServer ? <div className='mx_GeneralUserSettingsTab_discovery'>
            <span className="mx_SettingsTab_subheading">{_t("Email addresses")}</span>
            {emails}

            <span className="mx_SettingsTab_subheading">{_t("Phone numbers")}</span>
            {msisdns}
        </div> : null;

        return (
            <div className="mx_SettingsTab_section">
                {threepidSection}
                { /* has its own heading as it includes the current ID server */ }
                <SetIdServer />
            </div>
        );
    }

    _renderManagementSection() {
        // TODO: Improve warning text for account deactivation
        return (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{_t("Account management")}</span>
                <span className="mx_SettingsTab_subsectionText">
                    {_t("Deactivating your account is a permanent action - be careful!")}
                </span>
                <AccessibleButton onClick={this._onDeactivateClicked} kind="danger">
                    {_t("Deactivate Account")}
                </AccessibleButton>
            </div>
        );
    }

    _renderIntegrationManagerSection() {
        const SetIntegrationManager = sdk.getComponent("views.settings.SetIntegrationManager");

        return (
            <div className="mx_SettingsTab_section">
                { /* has its own heading as it includes the current integration manager */ }
                <SetIntegrationManager />
            </div>
        );
    }

    render() {
        const discoWarning = this.state.requiredPolicyInfo.hasTerms
            ? <img className='mx_GeneralUserSettingsTab_warningIcon'
                src={require("../../../../../../res/img/feather-customised/warning-triangle.svg")}
                width="18" height="18" alt={_t("Warning")} />
            : null;

        return (
            <div className="mx_SettingsTab">
                <div className="mx_SettingsTab_heading">{_t("General")}</div>
                {this._renderProfileSection()}
                {this._renderAccountSection()}
                {this._renderLanguageSection()}
                {this._renderThemeSection()}
                <div className="mx_SettingsTab_heading">{discoWarning} {_t("Discovery")}</div>
                {this._renderDiscoverySection()}
                {this._renderIntegrationManagerSection() /* Has its own title */}
                <div className="mx_SettingsTab_heading">{_t("Deactivate account")}</div>
                {this._renderManagementSection()}
            </div>
        );
    }
}
