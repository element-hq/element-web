/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import QRCode from "../QRCode";

interface IProps {
    /** The data for the QR code. If `undefined`, a spinner is shown. */
    qrCodeBytes: undefined | Uint8ClampedArray;
}

export default class VerificationQRCode extends React.PureComponent<IProps> {
    public render(): React.ReactNode {
        return (
            <QRCode
                data={this.props.qrCodeBytes === undefined ? null : [{ data: this.props.qrCodeBytes, mode: "byte" }]}
                className="mx_VerificationQRCode"
                width={196}
            />
        );
    }
}
