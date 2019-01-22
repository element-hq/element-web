/*
Copyright 2019 New Vector Ltd

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
import {_t} from "../../../../languageHandler";
import MatrixClientPeg from "../../../../MatrixClientPeg";
import GroupUserSettings from "../../groups/GroupUserSettings";
import PropTypes from "prop-types";
import {MatrixClient} from "matrix-js-sdk";
import { DragDropContext } from 'react-beautiful-dnd';
import ProfileSettings from "../ProfileSettings";
import EmailAddresses from "../EmailAddresses";
const sdk = require('../../../../index');
const Modal = require("../../../../Modal");

export default class GeneralSettingsTab extends React.Component {
    static childContextTypes = {
        matrixClient: PropTypes.instanceOf(MatrixClient),
    };

    constructor() {
        super();
    }

    getChildContext() {
        return {
            matrixClient: MatrixClientPeg.get(),
        };
    }

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

    _renderProfileSection() {
        // HACK/TODO: Using DragDropContext feels wrong, but we need it.
        return (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{_t("Profile")}</span>
                <ProfileSettings />

                <span className="mx_SettingsTab_subheading">{_t("Flair")}</span>
                <DragDropContext>
                    <GroupUserSettings />
                </DragDropContext>
            </div>
        );
    }

    _renderAccountSection() {
        const ChangePassword = sdk.getComponent("views.settings.ChangePassword");
        const passwordChangeForm = (
            <ChangePassword
                className="mx_GeneralSettingsTab_changePassword"
                rowClassName=""
                buttonKind="primary"
                onError={this._onPasswordChangeError}
                onFinished={this._onPasswordChanged} />
        );

        return (
            <div className="mx_SettingsTab_section mx_GeneralSettingsTab_accountSection">
                <span className="mx_SettingsTab_subheading">{_t("Account")}</span>
                <p className="mx_SettingsTab_subsectionText">
                    {_t("Set a new account password...")}
                </p>
                {passwordChangeForm}

                <span className="mx_SettingsTab_subheading">{_t("Email addresses")}</span>
                <EmailAddresses />
            </div>
        );
    }

    _renderLanguageSection() {
        return (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{_t("Language and region")}</span>
                <p>LANGUAGE SECTION</p>
            </div>
        );
    }

    _renderThemeSection() {
        return (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{_t("Theme")}</span>
                <p>THEME SECTION</p>
            </div>
        );
    }

    _renderManagementSection() {
        return (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{_t("Account management")}</span>
                <p>MANAGEMENT SECTION</p>
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
                {this._renderManagementSection()}
            </div>
        );
    }
}
