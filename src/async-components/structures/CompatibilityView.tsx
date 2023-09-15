/*
Copyright 2020 New Vector Ltd

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

import React, { ReactNode } from "react";
import SdkConfig from "matrix-react-sdk/src/SdkConfig";

import { _t } from "../../languageHandler";

// directly import the style here as this layer does not support rethemedex at this time so no matrix-react-sdk
// PostCSS variables will be accessible.
import "../../../res/css/structures/ErrorView.pcss";

interface IProps {
    onAccept(): void;
}

const CompatibilityView: React.FC<IProps> = ({ onAccept }) => {
    const brand = SdkConfig.get("brand");
    const mobileBuilds = SdkConfig.get("mobile_builds");

    let ios: JSX.Element | undefined;
    const iosCustomUrl = mobileBuilds?.ios;
    if (iosCustomUrl !== null) {
        // could be undefined or a string
        ios = (
            <>
                <p>
                    <strong>iOS</strong> (iPhone or iPad)
                </p>
                <a
                    href={iosCustomUrl || "https://apps.apple.com/app/vector/id1083446067"}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mx_ClearDecoration"
                >
                    <img height="48" src="themes/element/img/download/apple.svg" alt="Apple App Store" />
                </a>
            </>
        );
    }

    let android = [
        <p className="mx_Spacer" key="header">
            <strong>Android</strong>
        </p>,
    ];
    const andCustomUrl = mobileBuilds?.android;
    const fdroidCustomUrl = mobileBuilds?.fdroid;
    if (andCustomUrl !== null) {
        // undefined or string
        android.push(
            <a
                href={andCustomUrl || "https://play.google.com/store/apps/details?id=im.vector.app"}
                target="_blank"
                rel="noreferrer noopener"
                className="mx_ClearDecoration"
                key="android"
            >
                <img height="48" src="themes/element/img/download/google.svg" alt="Google Play Store" />
            </a>,
        );
    }
    if (fdroidCustomUrl !== null) {
        // undefined or string
        android.push(
            <a
                href={fdroidCustomUrl || "https://f-droid.org/repository/browse/?fdid=im.vector.app"}
                target="_blank"
                rel="noreferrer noopener"
                className="mx_ClearDecoration"
                key="fdroid"
            >
                <img height="48" src="themes/element/img/download/fdroid.svg" alt="F-Droid" />
            </a>,
        );
    }
    if (android.length === 1) {
        // just a header, meaning no links
        android = [];
    }

    let mobileHeader: ReactNode = <h2 id="step2_heading">{_t("use_brand_on_mobile", { brand })}</h2>;
    if (!android.length && !ios) {
        mobileHeader = null;
    }

    return (
        <div className="mx_ErrorView">
            <div className="mx_ErrorView_container">
                <div className="mx_HomePage_header">
                    <span className="mx_HomePage_logo">
                        <img height="42" src="themes/element/img/logos/element-logo.svg" alt="Element" />
                    </span>
                    <h1>{_t("incompatible_browser|title")}</h1>
                </div>

                <div className="mx_HomePage_col">
                    <div className="mx_HomePage_row">
                        <div>
                            <h2 id="step1_heading">{_t("incompatible_browser|summary", { brand })}</h2>
                            <p>{_t("incompatible_browser|features", { brand })}</p>
                            <p>
                                {_t(
                                    "incompatible_browser|browser_links",
                                    {},
                                    {
                                        chromeLink: (sub) => <a href="https://www.google.com/chrome">{sub}</a>,
                                        firefoxLink: (sub) => <a href="https://firefox.com">{sub}</a>,
                                        safariLink: (sub) => <a href="https://apple.com/safari">{sub}</a>,
                                    },
                                )}
                            </p>
                            <p>{_t("incompatible_browser|feature_warning")}</p>
                            <button onClick={onAccept}>{_t("incompatible_browser|continue_warning")}</button>
                        </div>
                    </div>
                </div>

                <div className="mx_HomePage_col">
                    <div className="mx_HomePage_row">
                        <div>
                            {mobileHeader}
                            {ios}
                            {android}
                        </div>
                    </div>
                </div>

                <div className="mx_HomePage_row mx_Center mx_Spacer">
                    <p className="mx_Spacer">
                        <a href="https://element.io" target="_blank" className="mx_FooterLink">
                            {_t("go_to_element_io")}
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CompatibilityView;
