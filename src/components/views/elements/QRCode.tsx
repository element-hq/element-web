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

import * as React from "react";
import {toDataURL, QRCodeSegment, QRCodeToDataURLOptions} from "qrcode";
import classNames from "classnames";

import {_t} from "../../../languageHandler";
import Spinner from "./Spinner";

interface IProps extends QRCodeToDataURLOptions {
    data: string | QRCodeSegment[];
    className?: string;
}

const defaultOptions: QRCodeToDataURLOptions = {
    errorCorrectionLevel: 'L', // we want it as trivial-looking as possible
};

const QRCode: React.FC<IProps> = ({data, className, ...options}) => {
    const [dataUri, setUri] = React.useState<string>(null);
    React.useEffect(() => {
        let cancelled = false;
        toDataURL(data, {...defaultOptions, ...options}).then(uri => {
            if (cancelled) return;
            setUri(uri);
        });
        return () => {
            cancelled = true;
        };
    }, [JSON.stringify(data), options]); // eslint-disable-line react-hooks/exhaustive-deps

    return <div className={classNames("mx_QRCode", className)}>
        { dataUri ? <img src={dataUri} className="mx_VerificationQRCode" alt={_t("QR Code")} /> : <Spinner /> }
    </div>;
};

export default QRCode;
