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
import SdkConfig from '../../../SdkConfig';
import ScalarAuthClient from '../../../ScalarAuthClient';
import ScalarMessaging from '../../../ScalarMessaging';
import Modal from "../../../Modal";
import { _t } from '../../../languageHandler';
import AccessibleButton from './AccessibleButton';
import TintableSvg from './TintableSvg';

export default class ManageIntegsButton extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            scalarError: null,
            showIntegrationsError: false,
        };

        this.onManageIntegrations = this.onManageIntegrations.bind(this);
        this.onShowIntegrationsError = this.onShowIntegrationsError.bind(this);
    }

    componentWillMount() {
        ScalarMessaging.startListening();
        this.scalarClient = null;

        if (SdkConfig.get().integrations_ui_url && SdkConfig.get().integrations_rest_url) {
            this.scalarClient = new ScalarAuthClient();
            this.scalarClient.connect().done(() => {
                this.forceUpdate();
            }, (err) => {
                this.setState({ scalarError: err});
                console.error(err);
            });
        }
    }

    componentWillUnmount() {
        ScalarMessaging.stopListening();
    }

    onManageIntegrations(ev) {
        ev.preventDefault();
        const IntegrationsManager = sdk.getComponent("views.settings.IntegrationsManager");
        Modal.createDialog(IntegrationsManager, {
            src: (this.scalarClient !== null && this.scalarClient.hasCredentials()) ?
                this.scalarClient.getScalarInterfaceUrlForRoom(this.props.roomId) :
                null,
        }, "mx_IntegrationsManager");
    }

    onShowIntegrationsError(ev) {
        ev.preventDefault();
        this.setState({
            showIntegrationsError: !this.state.showIntegrationsError,
        });
    }

    render() {
        let integrationsButton = <div />;
        let integrationsError;
        if (this.scalarClient !== null) {
            if (this.state.showIntegrationsError && this.state.scalarError) {
                integrationsError = (
                    <span className="mx_RoomSettings_integrationsButton_errorPopup">
                        { _t('Could not connect to the integration server') }
                    </span>
                );
            }

            if (this.scalarClient.hasCredentials()) {
                integrationsButton = (
                    <AccessibleButton className="mx_RoomHeader_button" onClick={this.onManageIntegrations} title={ _t('Manage Integrations') }>
                        <TintableSvg src="img/icons-apps.svg" width="35" height="35"/>
                    </AccessibleButton>
                );
            } else if (this.state.scalarError) {
                integrationsButton = (
                    <div className="mx_RoomSettings_integrationsButton_error" onClick={ this.onShowIntegrationsError }>
                        <img src="img/warning.svg" title={_t('Integrations Error')} width="17"/>
                        { integrationsError }
                    </div>
                );
            } else {
                integrationsButton = (
                    <AccessibleButton className="mx_RoomHeader_button" onClick={this.onManageIntegrations} title={ _t('Manage Integrations') }>
                        <TintableSvg src="img/icons-apps.svg" width="35" height="35"/>
                    </AccessibleButton>
                );
            }
        }

        return integrationsButton;
    }
}

ManageIntegsButton.propTypes = {
    roomId: PropTypes.string.isRequired,
};
