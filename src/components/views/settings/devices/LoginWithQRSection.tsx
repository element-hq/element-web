/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import type { IServerVersions } from "matrix-js-sdk/src/matrix";
import { _t } from "../../../../languageHandler";
import AccessibleButton from "../../elements/AccessibleButton";
import SettingsSubsection from "../shared/SettingsSubsection";

interface IProps {
    onShowQr: () => void;
    versions: IServerVersions;
}

export default class LoginWithQRSection extends React.Component<IProps> {
    public constructor(props: IProps) {
        super(props);
    }

    public render(): JSX.Element | null {
        // Needs server support for MSC3882 and MSC3886:
        const msc3882Supported = !!this.props.versions?.unstable_features?.["org.matrix.msc3882"];
        const msc3886Supported = !!this.props.versions?.unstable_features?.["org.matrix.msc3886"];
        const offerShowQr = msc3882Supported && msc3886Supported;

        // don't show anything if no method is available
        if (!offerShowQr) {
            return null;
        }

        return (
            <SettingsSubsection heading={_t("Sign in with QR code")}>
                <div className="mx_LoginWithQRSection">
                    <p className="mx_SettingsTab_subsectionText">
                        {_t(
                            "You can use this device to sign in a new device with a QR code. You will need to " +
                                "scan the QR code shown on this device with your device that's signed out.",
                        )}
                    </p>
                    <AccessibleButton onClick={this.props.onShowQr} kind="primary">
                        {_t("Show QR code")}
                    </AccessibleButton>
                </div>
            </SettingsSubsection>
        );
    }
}
