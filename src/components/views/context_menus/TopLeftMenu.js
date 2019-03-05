/*
Copyright 2018, 2019 New Vector Ltd

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
import dis from '../../../dispatcher';
import { _t } from '../../../languageHandler';
import LogoutDialog from "../dialogs/LogoutDialog";
import Modal from "../../../Modal";
import SdkConfig from '../../../SdkConfig';
import { getHostingLink } from '../../../utils/HostingLink';
import MatrixClientPeg from '../../../MatrixClientPeg';

export class TopLeftMenu extends React.Component {
    static propTypes = {
        displayName: PropTypes.string.isRequired,
        userId: PropTypes.string.isRequired,
        onFinished: PropTypes.func,
    };

    constructor() {
        super();
        this.viewHomePage = this.viewHomePage.bind(this);
        this.openSettings = this.openSettings.bind(this);
        this.signIn = this.signIn.bind(this);
        this.signOut = this.signOut.bind(this);
    }

    hasHomePage() {
        const config = SdkConfig.get();
        const pagesConfig = config.embeddedPages;
        if (pagesConfig && pagesConfig.homeUrl) {
            return true;
        }
        // This is a deprecated config option for the home page
        // (despite the name, given we also now have a welcome
        // page, which is not the same).
        return !!config.welcomePageUrl;
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
                        a: sub => <a href={hostingSignupLink} target="_blank" rel="noopener">{sub}</a>,
                    },
                )}
                <a href={hostingSignupLink} target="_blank" rel="noopener">
                    <img src={require("../../../../res/img/external-link.svg")} width="11" height="10" alt='' />
                </a>
            </div>;
        }

        let homePageSection = null;
        if (this.hasHomePage()) {
            homePageSection = <ul className="mx_TopLeftMenu_section_withIcon">
                <li className="mx_TopLeftMenu_icon_home" onClick={this.viewHomePage}>{_t("Home")}</li>
            </ul>;
        }

        let signInOutSection;
        if (isGuest) {
            signInOutSection = <ul className="mx_TopLeftMenu_section_withIcon">
                <li className="mx_TopLeftMenu_icon_signin" onClick={this.signIn}>{_t("Sign in")}</li>
            </ul>;
        } else {
            signInOutSection = <ul className="mx_TopLeftMenu_section_withIcon">
                <li className="mx_TopLeftMenu_icon_signout" onClick={this.signOut}>{_t("Sign out")}</li>
            </ul>;
        }

        return <div className="mx_TopLeftMenu">
            <div className="mx_TopLeftMenu_section_noIcon">
                <div>{this.props.displayName}</div>
                <div className="mx_TopLeftMenu_greyedText">{this.props.userId}</div>
                {hostingSignup}
            </div>
            {homePageSection}
            <ul className="mx_TopLeftMenu_section_withIcon">
                <li className="mx_TopLeftMenu_icon_settings" onClick={this.openSettings}>{_t("Settings")}</li>
            </ul>
            {signInOutSection}
        </div>;
    }

    viewHomePage() {
        dis.dispatch({action: 'view_home_page'});
        this.closeMenu();
    }

    openSettings() {
        dis.dispatch({action: 'view_user_settings'});
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
