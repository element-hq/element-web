/*
Copyright 2018, 2019 New Vector Ltd
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
import PropTypes from 'prop-types';
import dis from '../../../dispatcher/dispatcher';
import { _t } from '../../../languageHandler';
import LogoutDialog from "../dialogs/LogoutDialog";
import Modal from "../../../Modal";
import SdkConfig from '../../../SdkConfig';
import { getHostingLink } from '../../../utils/HostingLink';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import {MenuItem} from "../../structures/ContextMenu";
import * as sdk from "../../../index";
import {getHomePageUrl} from "../../../utils/pages";
import {Action} from "../../../dispatcher/actions";

export default class TopLeftMenu extends React.Component {
    static propTypes = {
        displayName: PropTypes.string.isRequired,
        userId: PropTypes.string.isRequired,
        onFinished: PropTypes.func,

        // Optional function to collect a reference to the container
        // of this component directly.
        containerRef: PropTypes.func,
    };

    constructor() {
        super();
        this.viewHomePage = this.viewHomePage.bind(this);
        this.openSettings = this.openSettings.bind(this);
        this.signIn = this.signIn.bind(this);
        this.signOut = this.signOut.bind(this);
    }

    hasHomePage() {
        return !!getHomePageUrl(SdkConfig.get());
    }

    render() {
        const isGuest = MatrixClientPeg.get().isGuest();

        const hostingSignupLink = getHostingLink('user-context-menu');
        let hostingSignup = null;
        if (hostingSignupLink) {
            hostingSignup = <div className="mx_TopLeftMenu_upgradeLink">
                {_t(
                    "<a>Upgrade</a> to your own domain", {},
                    {
                        a: sub =>
                            <a href={hostingSignupLink} target="_blank" rel="noreferrer noopener" tabIndex={-1}>{sub}</a>,
                    },
                )}
                <a href={hostingSignupLink} target="_blank" rel="noreferrer noopener" role="presentation" aria-hidden={true} tabIndex={-1}>
                    <img src={require("../../../../res/img/external-link.svg")} width="11" height="10" alt='' />
                </a>
            </div>;
        }

        let homePageItem = null;
        if (this.hasHomePage()) {
            homePageItem = (
                <MenuItem className="mx_TopLeftMenu_icon_home" onClick={this.viewHomePage}>
                    {_t("Home")}
                </MenuItem>
            );
        }

        let signInOutItem;
        if (isGuest) {
            signInOutItem = (
                <MenuItem className="mx_TopLeftMenu_icon_signin" onClick={this.signIn}>
                    {_t("Sign in")}
                </MenuItem>
            );
        } else {
            signInOutItem = (
                <MenuItem className="mx_TopLeftMenu_icon_signout" onClick={this.signOut}>
                    {_t("Sign out")}
                </MenuItem>
            );
        }

        const helpItem = (
            <MenuItem className="mx_TopLeftMenu_icon_help" onClick={this.openHelp}>
                {_t("Help")}
            </MenuItem>
        );

        const settingsItem = (
            <MenuItem className="mx_TopLeftMenu_icon_settings" onClick={this.openSettings}>
                {_t("Settings")}
            </MenuItem>
        );

        return <div className="mx_TopLeftMenu" ref={this.props.containerRef} role="menu">
            <div className="mx_TopLeftMenu_section_noIcon" aria-readonly={true} tabIndex={-1}>
                <div>{this.props.displayName}</div>
                <div className="mx_TopLeftMenu_greyedText" aria-hidden={true}>{this.props.userId}</div>
                {hostingSignup}
            </div>
            <ul className="mx_TopLeftMenu_section_withIcon" role="none">
                {homePageItem}
                {settingsItem}
                {helpItem}
                {signInOutItem}
            </ul>
        </div>;
    }

    openHelp = () => {
        this.closeMenu();
        const RedesignFeedbackDialog = sdk.getComponent("views.dialogs.RedesignFeedbackDialog");
        Modal.createTrackedDialog('Report bugs & give feedback', '', RedesignFeedbackDialog);
    };

    viewHomePage() {
        dis.dispatch({action: 'view_home_page'});
        this.closeMenu();
    }

    openSettings() {
        dis.fire(Action.ViewUserSettings);
        this.closeMenu();
    }

    signIn() {
        dis.dispatch({action: 'start_login'});
        this.closeMenu();
    }

    signOut() {
        Modal.createTrackedDialog('Logout E2E Export', '', LogoutDialog);
        this.closeMenu();
    }

    closeMenu() {
        if (this.props.onFinished) this.props.onFinished();
    }
}
