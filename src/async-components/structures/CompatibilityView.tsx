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

// directly import the style here as this layer does not support rethemedex at this time so no matrix-react-sdk
// scss variables will be accessible.
import "../../../res/css/structures/ErrorView.scss";

interface IProps {
    onAccept(): void;
}

const CompatibilityView: React.FC<IProps> = ({ onAccept }) => {
    return <div className="mx_ErrorView">
        <div className="mx_ErrorView_container">
            <div className="mx_HomePage_header">
                <span className="mx_HomePage_logo">
                    <img height="42" src="themes/riot/img/logos/riot-logo.svg" alt="Riot" />
                </span>
                <h1>{ _t("Unsupported browser") }</h1>
            </div>

            <div className="mx_HomePage_col">
                <div className="mx_HomePage_row">
                    <div>
                        <h2 id="step1_heading">{ _t("Your browser can't run Riot") }</h2>
                        <p>
                            { _t(
                                "Riot uses advanced browser features which aren't supported by your current browser.",
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
                        <h2 id="step2_heading">Use Riot on mobile</h2>
                        <p><strong>iOS</strong> (iPhone or iPad)</p>
                        <a href="https://itunes.apple.com/app/riot-im/id1083446067?mt=8" target="_blank"
                           className="mx_ClearDecoration">
                            <img height="48" src="themes/riot/img/download/apple.svg" alt="Apple App Store" />
                        </a>
                        <p className="mx_Spacer"><strong>Android</strong></p>
                        <a href="https://play.google.com/store/apps/details?id=im.vector.app" target="_blank"
                           className="mx_ClearDecoration">
                            <img height="48" src="themes/riot/img/download/google.svg" alt="Google Play Store" />
                        </a>
                        <a href="https://f-droid.org/repository/browse/?fdid=im.vector.alpha" target="_blank"
                           className="mx_ClearDecoration">
                            <img height="48" src="themes/riot/img/download/fdroid.svg" alt="F-Droid" />
                        </a>
                    </div>
                </div>
            </div>

            <div className="mx_HomePage_row mx_Center mx_Spacer">
                <p className="mx_Spacer">
                    <a href="https://riot.im" target="_blank" className="mx_FooterLink">
                        { _t("Go to Riot.im") }
                    </a>
                </p>
            </div>
        </div>
    </div>;
};

export default CompatibilityView;
