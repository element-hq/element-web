/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { Glass } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";
import { SetupEncryptionStore, Phase } from "../../../stores/SetupEncryptionStore";
import SetupEncryptionBody from "./SetupEncryptionBody";
import AccessibleButton from "../../views/elements/AccessibleButton";
import CompleteSecurityBody from "../../views/auth/CompleteSecurityBody";
import AuthPage from "../../views/auth/AuthPage";
import SdkConfig from "../../../SdkConfig";

interface IProps {
    onFinished: () => void;
}

interface IState {
    phase?: Phase;
}

/**
 * Prompts the user to verify their device when they first log in.
 */
export default class CompleteSecurity extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        const store = SetupEncryptionStore.sharedInstance();
        store.start();
        this.state = { phase: store.phase };
    }

    public componentDidMount(): void {
        const store = SetupEncryptionStore.sharedInstance();
        store.on("update", this.onStoreUpdate);
    }

    private onStoreUpdate = (): void => {
        const store = SetupEncryptionStore.sharedInstance();
        this.setState({ phase: store.phase });
    };

    private onSkipClick = (): void => {
        const store = SetupEncryptionStore.sharedInstance();
        store.skip();
    };

    public componentWillUnmount(): void {
        const store = SetupEncryptionStore.sharedInstance();
        store.off("update", this.onStoreUpdate);
        store.stop();
    }

    public render(): React.ReactNode {
        const { phase } = this.state;
        let icon;
        let title;

        if (phase === Phase.Loading) {
            return null;
        } else if (phase === Phase.Intro) {
            // We don't specify an icon nor title since `SetupEncryptionBody` provides its own
        } else if (phase === Phase.Done) {
            icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_verified" />;
            title = _t("encryption|verification|after_new_login|device_verified");
        } else if (phase === Phase.ConfirmSkip) {
            icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_warning" />;
            title = _t("common|are_you_sure");
        } else if (phase === Phase.Busy) {
            icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_warning" />;
            title = _t("encryption|verification|after_new_login|verify_this_device");
        } else if (phase === Phase.Finished) {
            // SetupEncryptionBody will take care of calling onFinished, we don't need to do anything
        } else {
            throw new Error(`Unknown phase ${phase}`);
        }

        const forceVerification = SdkConfig.get("force_verification");

        let skipButton;
        if (!forceVerification && phase === Phase.Intro) {
            skipButton = (
                <AccessibleButton
                    onClick={this.onSkipClick}
                    className="mx_CompleteSecurity_skip"
                    aria-label={_t("encryption|verification|after_new_login|skip_verification")}
                />
            );
        }

        return (
            <AuthPage modalClass="mx_AuthPage_modal_noBlur">
                <Glass className="mx_Dialog_border">
                    <CompleteSecurityBody>
                        <h1 className="mx_CompleteSecurity_header">
                            {icon}
                            {title}
                            {skipButton}
                        </h1>
                        <div className="mx_CompleteSecurity_body">
                            <SetupEncryptionBody onFinished={this.props.onFinished} allowLogout={true} />
                        </div>
                    </CompleteSecurityBody>
                </Glass>
            </AuthPage>
        );
    }
}
