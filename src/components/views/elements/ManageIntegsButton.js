/*
Copyright 2017 New Vector Ltd

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
import sdk from '../../../index';
import classNames from 'classnames';
import SdkConfig from '../../../SdkConfig';
import ScalarAuthClient from '../../../ScalarAuthClient';
import ScalarMessaging from '../../../ScalarMessaging';
import Modal from "../../../Modal";
import { _t } from '../../../languageHandler';
import AccessibleButton from './AccessibleButton';

export default class ManageIntegsButton extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            scalarError: null,
        };

        this.onManageIntegrations = this.onManageIntegrations.bind(this);
    }

    componentWillMount() {
        ScalarMessaging.startListening();
        this.scalarClient = null;

        if (SdkConfig.get().integrations_ui_url && SdkConfig.get().integrations_rest_url) {
            this.scalarClient = new ScalarAuthClient();
            this.scalarClient.connect().done(() => {
                this.forceUpdate();
            }, (err) => {
                this.setState({scalarError: err});
                console.error('Error whilst initialising scalarClient for ManageIntegsButton', err);
            });
        }
    }

    componentWillUnmount() {
        ScalarMessaging.stopListening();
    }

    onManageIntegrations(ev) {
        ev.preventDefault();
        if (this.state.scalarError && !this.scalarClient.hasCredentials()) {
            return;
        }
        const IntegrationsManager = sdk.getComponent("views.settings.IntegrationsManager");
        this.scalarClient.connect().done(() => {
            Modal.createDialog(IntegrationsManager, {
                src: (this.scalarClient !== null && this.scalarClient.hasCredentials()) ?
                    this.scalarClient.getScalarInterfaceUrlForRoom(this.props.room) :
                    null,
            }, "mx_IntegrationsManager");
        }, (err) => {
            this.setState({scalarError: err});
            console.error('Error ensuring a valid scalar_token exists', err);
        });
    }

    render() {
        let integrationsButton = <div />;
        let integrationsWarningTriangle = <div />;
        let integrationsErrorPopup = <div />;
        if (this.scalarClient !== null) {
            const integrationsButtonClasses = classNames({
                mx_RoomHeader_button: true,
                mx_RoomHeader_manageIntegsButton: true,
                mx_ManageIntegsButton_error: !!this.state.scalarError,
            });

            if (this.state.scalarError && !this.scalarClient.hasCredentials()) {
                integrationsWarningTriangle = <img
                    src={require("../../../../res/img/warning.svg")}
                    title={_t('Integrations Error')}
                    width="17"
                />;
                // Popup shown when hovering over integrationsButton_error (via CSS)
                integrationsErrorPopup = (
                    <span className="mx_ManageIntegsButton_errorPopup">
                        { _t('Could not connect to the integration server') }
                    </span>
                );
            }

            integrationsButton = (
                <AccessibleButton className={integrationsButtonClasses}
                    onClick={this.onManageIntegrations}
                    title={_t('Manage Integrations')}
                >
                    { integrationsWarningTriangle }
                    { integrationsErrorPopup }
                </AccessibleButton>
            );
        }

        return integrationsButton;
    }
}

ManageIntegsButton.propTypes = {
    room: PropTypes.object.isRequired,
};
