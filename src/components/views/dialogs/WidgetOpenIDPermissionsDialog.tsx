/*
Copyright 2019 Travis Ralston
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { Widget, WidgetKind } from "matrix-widget-api";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import { OIDCState } from "../../../stores/widgets/WidgetPermissionStore";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import { SdkContextClass } from "../../../contexts/SDKContext";

interface IProps {
    widget: Widget;
    widgetKind: WidgetKind;
    inRoomId?: string;
    onFinished(allowed?: boolean): void;
}

interface IState {
    rememberSelection: boolean;
}

export default class WidgetOpenIDPermissionsDialog extends React.PureComponent<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            rememberSelection: false,
        };
    }

    private onAllow = (): void => {
        this.onPermissionSelection(true);
    };

    private onDeny = (): void => {
        this.onPermissionSelection(false);
    };

    private onPermissionSelection(allowed: boolean): void {
        if (this.state.rememberSelection) {
            logger.log(`Remembering ${this.props.widget.id} as allowed=${allowed} for OpenID`);

            SdkContextClass.instance.widgetPermissionStore.setOIDCState(
                this.props.widget,
                this.props.widgetKind,
                this.props.inRoomId,
                allowed ? OIDCState.Allowed : OIDCState.Denied,
            );
        }

        this.props.onFinished(allowed);
    }

    private onRememberSelectionChange = (newVal: boolean): void => {
        this.setState({ rememberSelection: newVal });
    };

    public render(): React.ReactNode {
        return (
            <BaseDialog
                className="mx_WidgetOpenIDPermissionsDialog"
                hasCancel={true}
                onFinished={this.props.onFinished}
                title={_t("Allow this widget to verify your identity")}
            >
                <div className="mx_WidgetOpenIDPermissionsDialog_content">
                    <p>{_t("The widget will verify your user ID, but won't be able to perform actions for you:")}</p>
                    <p className="text-muted">
                        {/* cheap trim to just get the path */}
                        {this.props.widget.templateUrl.split("?")[0].split("#")[0]}
                    </p>
                </div>
                <DialogButtons
                    primaryButton={_t("Continue")}
                    onPrimaryButtonClick={this.onAllow}
                    onCancel={this.onDeny}
                    additive={
                        <LabelledToggleSwitch
                            value={this.state.rememberSelection}
                            toggleInFront={true}
                            onChange={this.onRememberSelectionChange}
                            label={_t("Remember this")}
                        />
                    }
                />
            </BaseDialog>
        );
    }
}
