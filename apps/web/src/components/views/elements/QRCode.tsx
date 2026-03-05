/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { toDataURL, type QRCodeSegment, type QRCodeToDataURLOptions, type QRCodeRenderersOptions } from "qrcode";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import Spinner from "./Spinner";

interface IProps extends QRCodeRenderersOptions {
    /** The data for the QR code. If `null`, a spinner is shown. */
    data: null | string | QRCodeSegment[];
    className?: string;
}

const defaultOptions: QRCodeToDataURLOptions = {
    errorCorrectionLevel: "L", // we want it as trivial-looking as possible
};

const QRCode: React.FC<IProps> = ({ data, className, ...options }) => {
    const [dataUri, setUri] = React.useState<string | null>(null);
    React.useEffect(() => {
        if (data === null) {
            setUri(null);
            return;
        }
        let cancelled = false;
        toDataURL(data, { ...defaultOptions, ...options }).then((uri) => {
            if (cancelled) return;
            setUri(uri);
        });
        return () => {
            cancelled = true;
        };
    }, [JSON.stringify(data), options]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className={classNames("mx_QRCode", className)}>
            {dataUri ? <img src={dataUri} className="mx_VerificationQRCode" alt={_t("common|qr_code")} /> : <Spinner />}
        </div>
    );
};

export default QRCode;
