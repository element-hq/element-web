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

import * as React from "react";
import { _t } from "matrix-react-sdk/src/languageHandler";
import SdkConfig from 'matrix-react-sdk/src/SdkConfig';

// directly import the style here as this layer does not support rethemedex at this time so no matrix-react-sdk
// scss variables will be accessible.
import "../../../res/css/structures/ErrorView.scss";

interface IProps {
    onAccept(): void;
}

const CompatibilityView: React.FC<IProps> = ({ onAccept }) => {
    const { brand, mobileBuilds } = SdkConfig.get();

    let ios = null;
    const iosCustomUrl = mobileBuilds?.ios;
    if (iosCustomUrl !== null) { // could be undefined or a string
        ios = <>
            <p><strong>iOS</strong> (iPhone or iPad)</p>
            <a
                href={iosCustomUrl || "https://apps.apple.com/app/vector/id1083446067"}
                target="_blank"
                className="mx_ClearDecoration"
            >
                <img height="48" src="themes/element/img/download/apple.svg" alt="Apple App Store" />
            </a>
        </>;
    }

    let android = [<p className="mx_Spacer" key="header"><strong>Android</strong></p>];
    const andCustomUrl = mobileBuilds?.android;
    const fdroidCustomUrl = mobileBuilds?.fdroid;
    if (andCustomUrl !== null) { // undefined or string
        android.push(<a
            href={andCustomUrl || "https://play.google.com/store/apps/details?id=im.vector.app"}
            target="_blank"
            className="mx_ClearDecoration"
            key="android"
        >
            <img height="48" src="themes/element/img/download/google.svg" alt="Google Play Store" />
        </a>);
    }
    if (fdroidCustomUrl !== null) { // undefined or string
        android.push(<a
            href={fdroidCustomUrl || "https://f-droid.org/repository/browse/?fdid=im.vector.app"}
            target="_blank"
            className="mx_ClearDecoration"
            key="fdroid"
        >
            <img height="48" src="themes/element/img/download/fdroid.svg" alt="F-Droid" />
        </a>);
    }
    if (android.length === 1) { // just a header, meaning no links
        android = [];
    }

    let mobileHeader = <h2 id="step2_heading">{_t("Use %(brand)s on mobile", { brand })}</h2>;
    if (!android.length && !ios) {
        mobileHeader = null;
    }

    return <div className="mx_ErrorView">
        <div className="mx_ErrorView_container">
            <div className="mx_HomePage_header">
                <span className="mx_HomePage_logo">
                    <img height="42" src="themes/element/img/logos/element-logo.svg" alt="Element" />
                </span>
                <h1>{ _t("Unsupported browser") }</h1>
            </div>

            <div className="mx_HomePage_col">
                <div className="mx_HomePage_row">
                    <div>
                        <h2 id="step1_heading">{ _t("Your browser can't run %(brand)s", { brand }) }</h2>
                        <p>
                            { _t(
                                "%(brand)s uses advanced browser features which aren't " +
                                "supported by your current browser.",
                                { brand },
                            ) }
                        </p>
                        <p>
                            { _t(
                                'Please install <chromeLink>Chrome</chromeLink>, <firefoxLink>Firefox</firefoxLink>, ' +
                                'or <safariLink>Safari</safariLink> for the best experience.',
                                {},
                                {
                                    'chromeLink': (sub) => <a href="https://www.google.com/chrome">{sub}</a>,
                                    'firefoxLink': (sub) => <a href="https://firefox.com">{sub}</a>,
                                    'safariLink': (sub) => <a href="https://apple.com/safari">{sub}</a>,
                                },
                            )}
                        </p>
                        <p>
                            { _t(
                                "You can continue using your current browser, but some or all features may not work " +
                                "and the look and feel of the application may be incorrect.",
                            ) }
                        </p>
                        <button onClick={onAccept}>
                            { _t("I understand the risks and wish to continue") }
                        </button>
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
                        { _t("Go to element.io") }
                    </a>
                </p>
            </div>
        </div>
    </div>;
};

export default CompatibilityView;
