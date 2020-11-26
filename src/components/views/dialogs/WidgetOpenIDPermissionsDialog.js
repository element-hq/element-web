/*
Copyright 2019 Travis Ralston

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
import {_t} from "../../../languageHandler";
import * as sdk from "../../../index";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import {Widget} from "matrix-widget-api";
import {OIDCState, WidgetPermissionStore} from "../../../stores/widgets/WidgetPermissionStore";

export default class WidgetOpenIDPermissionsDialog extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
        widget: PropTypes.objectOf(Widget).isRequired,
        widgetKind: PropTypes.string.isRequired, // WidgetKind from widget-api
        inRoomId: PropTypes.string,
    };

    constructor() {
        super();

        this.state = {
            rememberSelection: false,
        };
    }

    _onAllow = () => {
        this._onPermissionSelection(true);
    };

    _onDeny = () => {
        this._onPermissionSelection(false);
    };

    _onPermissionSelection(allowed) {
        if (this.state.rememberSelection) {
            console.log(`Remembering ${this.props.widgetId} as allowed=${allowed} for OpenID`);

            WidgetPermissionStore.instance.setOIDCState(
                this.props.widget, this.props.widgetKind, this.props.inRoomId,
                allowed ? OIDCState.Allowed : OIDCState.Denied,
            );
        }

        this.props.onFinished(allowed);
    }

    _onRememberSelectionChange = (newVal) => {
        this.setState({rememberSelection: newVal});
    };

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        return (
            <BaseDialog className='mx_WidgetOpenIDPermissionsDialog' hasCancel={true}
                        onFinished={this.props.onFinished}
                        title={_t("A widget would like to verify your identity")}>
                <div className='mx_WidgetOpenIDPermissionsDialog_content'>
                    <p>
                        {_t(
                            "A widget located at %(widgetUrl)s would like to verify your identity. " +
                            "By allowing this, the widget will be able to verify your user ID, but not " +
                            "perform actions as you.", {
                                widgetUrl: this.props.widget.templateUrl.split("?")[0],
                            },
                        )}
                    </p>
                    <LabelledToggleSwitch value={this.state.rememberSelection} toggleInFront={true}
                                          onChange={this._onRememberSelectionChange}
                                          label={_t("Remember my selection for this widget")} />
                </div>
                <DialogButtons
                    primaryButton={_t("Allow")}
                    onPrimaryButtonClick={this._onAllow}
                    cancelButton={_t("Deny")}
                    onCancel={this._onDeny}
                />
            </BaseDialog>
        );
    }
}
