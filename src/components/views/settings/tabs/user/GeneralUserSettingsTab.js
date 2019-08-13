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
import {THEMES} from "../../../../../themes";
import PlatformPeg from "../../../../../PlatformPeg";
import MatrixClientPeg from "../../../../../MatrixClientPeg";
import sdk from "../../../../..";
import Modal from "../../../../../Modal";
import dis from "../../../../../dispatcher";

export default class GeneralUserSettingsTab extends React.Component {
    static propTypes = {
        closeSettingsFn: PropTypes.func.isRequired,
    };

    constructor() {
        super();

        this.state = {
            language: languageHandler.getCurrentLanguage(),
            theme: SettingsStore.getValueAt(SettingLevel.ACCOUNT, "theme"),
            haveIdServer: Boolean(MatrixClientPeg.get().getIdentityServerUrl()),
        };

        this.dispatcherRef = dis.register(this._onAction);
    }

    componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
    }

    _onAction = (payload) => {
        if (payload.action === 'id_server_changed') {
            this.setState({haveIdServer: Boolean(MatrixClientPeg.get().getIdentityServerUrl())});
        }
    };

    _onLanguageChange = (newLanguage) => {
        if (this.state.language === newLanguage) return;

        SettingsStore.setValue("language", null, SettingLevel.DEVICE, newLanguage);
        this.setState({language: newLanguage});
        PlatformPeg.get().reload();
    };

    _onThemeChange = (e) => {
        const newTheme = e.target.value;
        if (this.state.theme === newTheme) return;

        SettingsStore.setValue("theme", null, SettingLevel.ACCOUNT, newTheme);
        this.setState({theme: newTheme});
        dis.dispatch({action: 'set_theme', value: newTheme});
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
                "push notifications on other devices until you log back in to them",
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

        const passwordChangeForm = (
            <ChangePassword
                className="mx_GeneralUserSettingsTab_changePassword"
                rowClassName=""
                buttonKind="primary"
                onError={this._onPasswordChangeError}
                onFinished={this._onPasswordChanged} />
        );

        const threepidSection = this.state.haveIdServer ? <div>
            <span className="mx_SettingsTab_subheading">{_t("Email addresses")}</span>
            <EmailAddresses />

            <span className="mx_SettingsTab_subheading">{_t("Phone numbers")}</span>
            <PhoneNumbers />
        </div> : null;

        return (
            <div className="mx_SettingsTab_section mx_GeneralUserSettingsTab_accountSection">
                <span className="mx_SettingsTab_subheading">{_t("Account")}</span>
                <p className="mx_SettingsTab_subsectionText">
                    {_t("Set a new account password...")}
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
        return (
            <div className="mx_SettingsTab_section mx_GeneralUserSettingsTab_themeSection">
                <span className="mx_SettingsTab_subheading">{_t("Theme")}</span>
                <Field id="theme" label={_t("Theme")} element="select"
                       value={this.state.theme} onChange={this._onThemeChange}>
                    {Object.entries(THEMES).map(([theme, text]) => {
                        return <option key={theme} value={theme}>{_t(text)}</option>;
                    })}
                </Field>
                <SettingsFlag name="useCompactLayout" level={SettingLevel.ACCOUNT} />
            </div>
        );
    }

    _renderDiscoverySection() {
        const EmailAddresses = sdk.getComponent("views.settings.discovery.EmailAddresses");
        const PhoneNumbers = sdk.getComponent("views.settings.discovery.PhoneNumbers");
        const SetIdServer = sdk.getComponent("views.settings.SetIdServer");

        return (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{_t("Email addresses")}</span>
                <EmailAddresses />

                <span className="mx_SettingsTab_subheading">{_t("Phone numbers")}</span>
                <PhoneNumbers />
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

    render() {
        return (
            <div className="mx_SettingsTab">
                <div className="mx_SettingsTab_heading">{_t("General")}</div>
                {this._renderProfileSection()}
                {this._renderAccountSection()}
                {this._renderLanguageSection()}
                {this._renderThemeSection()}
                <div className="mx_SettingsTab_heading">{_t("Discovery")}</div>
                {this._renderDiscoverySection()}
                <div className="mx_SettingsTab_heading">{_t("Deactivate account")}</div>
                {this._renderManagementSection()}
            </div>
        );
    }
}
