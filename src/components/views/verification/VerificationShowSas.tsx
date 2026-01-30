/*
Copyright 2024 New Vector Ltd.
Copyright 2019 Vector Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps } from "react";
import { type Device } from "matrix-js-sdk/src/matrix";
import { type GeneratedSas } from "matrix-js-sdk/src/crypto-api";
import { SasEmoji } from "@element-hq/web-shared-components";

import { _t } from "../../../languageHandler";
import { PendingActionSpinner } from "../right_panel/EncryptionInfo";
import AccessibleButton from "../elements/AccessibleButton";

interface IProps {
    pending?: boolean;
    displayName?: string; // required if pending is true

    /** Details of the other device involved in the verification, if known */
    otherDeviceDetails?: Device;

    onDone: () => void;
    onCancel: () => void;
    sas: GeneratedSas;
    isSelf?: boolean;
    inDialog?: boolean; // whether this component is being shown in a dialog and to use DialogButtons
}

interface IState {
    pending: boolean;
    cancelling?: boolean;
}

export default class VerificationShowSas extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            pending: false,
        };
    }

    private onMatchClick = (): void => {
        this.setState({ pending: true });
        this.props.onDone();
    };

    private onDontMatchClick = (): void => {
        this.setState({ cancelling: true });
        this.props.onCancel();
    };

    public render(): React.ReactNode {
        let sasDisplay;
        let sasCaption;
        if (this.props.sas.emoji) {
            sasDisplay = (
                <SasEmoji
                    className="mx_VerificationShowSas_emojiSas"
                    emoji={this.props.sas.emoji.map((e) => e[0]) as ComponentProps<typeof SasEmoji>["emoji"]}
                />
            );
            sasCaption = this.props.isSelf
                ? _t("encryption|verification|confirm_the_emojis")
                : _t("encryption|verification|sas_emoji_caption_user");
        } else if (this.props.sas.decimal) {
            const numberBlocks = this.props.sas.decimal.map((num, i) => <span key={i}>{num}</span>);
            sasDisplay = <div className="mx_VerificationShowSas_decimalSas">{numberBlocks}</div>;
            sasCaption = this.props.isSelf
                ? _t("encryption|verification|sas_caption_self")
                : _t("encryption|verification|sas_caption_user");
        } else {
            return (
                <div>
                    {_t("encryption|verification|unsupported_method")}
                    <AccessibleButton kind="primary" onClick={this.props.onCancel}>
                        {_t("action|cancel")}
                    </AccessibleButton>
                </div>
            );
        }

        let confirm;
        if (this.state.pending && this.props.isSelf) {
            let text;
            // device shouldn't be null in this situation but it can be, eg. if the device is
            // logged out during verification
            const otherDevice = this.props.otherDeviceDetails;
            if (otherDevice) {
                text = _t("encryption|verification|waiting_other_device_details", {
                    deviceName: otherDevice.displayName,
                    deviceId: otherDevice.deviceId,
                });
            } else {
                text = _t("encryption|verification|waiting_other_device");
            }
            confirm = <p>{text}</p>;
        } else if (this.state.pending || this.state.cancelling) {
            let text;
            if (this.state.pending) {
                const { displayName } = this.props;
                text = _t("encryption|verification|waiting_other_user", { displayName });
            } else {
                text = _t("encryption|verification|cancelling");
            }
            confirm = <PendingActionSpinner text={text} />;
        } else {
            confirm = (
                <div className="mx_VerificationShowSas_buttonRow">
                    <AccessibleButton onClick={this.onMatchClick} kind="primary">
                        {_t("encryption|verification|sas_match")}
                    </AccessibleButton>
                    <AccessibleButton onClick={this.onDontMatchClick} kind="secondary">
                        {_t("encryption|verification|sas_no_match")}
                    </AccessibleButton>
                </div>
            );
        }

        return (
            <div className="mx_VerificationShowSas">
                <p>{sasCaption}</p>
                {sasDisplay}
                <p>{this.props.isSelf ? "" : _t("encryption|verification|in_person")}</p>
                {confirm}
            </div>
        );
    }
}
