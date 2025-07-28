/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.
Copyright 2019 Travis Ralston

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEventHandler } from "react";
import { type Widget, type WidgetKind } from "matrix-widget-api";
import { logger } from "matrix-js-sdk/src/logger";
import { Form, SettingsToggleInput } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";
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

    private onRememberSelectionChange: ChangeEventHandler<HTMLInputElement> = (evt): void => {
        this.setState({ rememberSelection: evt.target.checked });
    };

    public render(): React.ReactNode {
        return (
            <BaseDialog
                className="mx_WidgetOpenIDPermissionsDialog"
                hasCancel={true}
                onFinished={this.props.onFinished}
                title={_t("widget|open_id_permissions_dialog|title")}
            >
                <div className="mx_WidgetOpenIDPermissionsDialog_content">
                    <p>{_t("widget|open_id_permissions_dialog|starting_text")}</p>
                    <p className="text-muted">
                        {/* cheap trim to just get the path */}
                        {this.props.widget.templateUrl.split("?")[0].split("#")[0]}
                    </p>
                </div>
                <DialogButtons
                    primaryButton={_t("action|continue")}
                    onPrimaryButtonClick={this.onAllow}
                    onCancel={this.onDeny}
                    additive={
                        <Form.Root
                            onSubmit={(evt) => {
                                evt.preventDefault();
                                evt.stopPropagation();
                            }}
                        >
                            <SettingsToggleInput
                                name="remember-selection"
                                checked={this.state.rememberSelection}
                                onChange={this.onRememberSelectionChange}
                                label={_t("widget|open_id_permissions_dialog|remember_selection")}
                            />
                        </Form.Root>
                    }
                />
            </BaseDialog>
        );
    }
}
