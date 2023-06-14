/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { _t } from "../../../languageHandler";
import { SetupEncryptionStore, Phase } from "../../../stores/SetupEncryptionStore";
import SetupEncryptionBody from "./SetupEncryptionBody";
import AccessibleButton from "../../views/elements/AccessibleButton";
import CompleteSecurityBody from "../../views/auth/CompleteSecurityBody";
import AuthPage from "../../views/auth/AuthPage";

interface IProps {
    onFinished: () => void;
}

interface IState {
    phase?: Phase;
    lostKeys: boolean;
}

export default class CompleteSecurity extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        const store = SetupEncryptionStore.sharedInstance();
        store.on("update", this.onStoreUpdate);
        store.start();
        this.state = { phase: store.phase, lostKeys: store.lostKeys() };
    }

    private onStoreUpdate = (): void => {
        const store = SetupEncryptionStore.sharedInstance();
        this.setState({ phase: store.phase, lostKeys: store.lostKeys() });
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
        const { phase, lostKeys } = this.state;
        let icon;
        let title;

        if (phase === Phase.Loading) {
            return null;
        } else if (phase === Phase.Intro) {
            if (lostKeys) {
                icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_warning" />;
                title = _t("Unable to verify this device");
            } else {
                icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_warning" />;
                title = _t("Verify this device");
            }
        } else if (phase === Phase.Done) {
            icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_verified" />;
            title = _t("Device verified");
        } else if (phase === Phase.ConfirmSkip) {
            icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_warning" />;
            title = _t("Are you sure?");
        } else if (phase === Phase.Busy) {
            icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_warning" />;
            title = _t("Verify this device");
        } else if (phase === Phase.ConfirmReset) {
            icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_warning" />;
            title = _t("Really reset verification keys?");
        } else if (phase === Phase.Finished) {
            // SetupEncryptionBody will take care of calling onFinished, we don't need to do anything
        } else {
            throw new Error(`Unknown phase ${phase}`);
        }

        let skipButton;
        if (phase === Phase.Intro || phase === Phase.ConfirmReset) {
            skipButton = (
                <AccessibleButton
                    onClick={this.onSkipClick}
                    className="mx_CompleteSecurity_skip"
                    aria-label={_t("Skip verification for now")}
                />
            );
        }

        return (
            <AuthPage>
                <CompleteSecurityBody>
                    <h1 className="mx_CompleteSecurity_header">
                        {icon}
                        {title}
                        {skipButton}
                    </h1>
                    <div className="mx_CompleteSecurity_body">
                        <SetupEncryptionBody onFinished={this.props.onFinished} />
                    </div>
                </CompleteSecurityBody>
            </AuthPage>
        );
    }
}
