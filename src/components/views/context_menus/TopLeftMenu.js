/*
Copyright 2018 New Vector Ltd

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
import dis from '../../../dispatcher';
import { _t } from '../../../languageHandler';

export class TopLeftMenu extends React.Component {
    constructor() {
        super();
        this.openSettings = this.openSettings.bind(this);
        this.signOut = this.signOut.bind(this);
    }

    render() {
        return <div className="mx_TopLeftMenu">
            <ul className="mx_TopLeftMenu_section">
                <li onClick={this.openSettings}>{_t("Settings")}</li>
            </ul>
            <ul className="mx_TopLeftMenu_section">
                <li onClick={this.signOut}>{_t("Sign out")}</li>
            </ul>
        </div>;
    }

    openSettings() {
        dis.dispatch({action: 'view_user_settings'});
        this.closeMenu();
    }

    signOut() {
        dis.dispatch({action: 'logout'});
        this.closeMenu();
    }

    closeMenu() {
        if (this.props.onFinished) this.props.onFinished();
    }
}
