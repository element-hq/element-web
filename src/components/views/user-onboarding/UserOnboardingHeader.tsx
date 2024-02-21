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

import SdkConfig from "matrix-react-sdk/src/SdkConfig";
import AccessibleButton from "matrix-react-sdk/src/components/views/elements/AccessibleButton";
import { useMatrixClientContext } from "matrix-react-sdk/src/contexts/MatrixClientContext";
import { _t } from "matrix-react-sdk/src/languageHandler";
import { DirectoryMember, startDmOnFirstMessage } from "matrix-react-sdk/src/utils/direct-messages";
import * as React from "react";
import { useAtom } from "jotai";

import { botAccountsAtom } from "../../../atoms";
import { Icon as ChromeIcon } from "../../../../res/themes/superhero/img/icons/chrome.svg";
import { Icon as FirefoxIcon } from "../../../../res/themes/superhero/img/icons/firefox.svg";
import { Icon as WelcomeAeBot } from "../../../../res/themes/superhero/img/arts/welcome-ae-bot.svg";

export function UserOnboardingHeader(): JSX.Element {
    const cli = useMatrixClientContext();
    const [botAccounts] = useAtom(botAccountsAtom);
    const title = _t("onboarding|welcome_to_brand", {
        brand: SdkConfig.get("brand"),
    });

    return (
        <div className="sh_userOnboarding">
            <div className="sh_userOnboarding_bot_art">
                <WelcomeAeBot />
            </div>

            <div className="sh_userOnboarding_content">
                <h1>{title}</h1>
                <p>
                    With free end-to-end encrypted messaging, and unlimited voice and video calls, Superhero is a great
                    way to stay in touch. But that's not all! With Superhero Chat you will be able to access token-gated
                    chat rooms and create your own communities.
                </p>

                <div>
                    <div className="mx_Heading_h2">Let's get started!</div>

                    <div>
                        <div>
                            <p>Download and install Superhero Wallet browser extension:</p>
                            <div className="sh_userOnboarding_download_link">
                                <AccessibleButton
                                    onClick={(): void => {
                                        window.open(
                                            "https://chromewebstore.google.com/detail/superhero/mnhmmkepfddpifjkamaligfeemcbhdne",
                                            "_blank",
                                        );
                                    }}
                                    className="sh_userOnboarding_download_option"
                                >
                                    <ChromeIcon style={{ width: "22px", height: "22px", top: "7px", left: "18px" }} />
                                    <div className="sh_userOnboarding_download_option_label">from Chrome Web Store</div>
                                </AccessibleButton>
                                <AccessibleButton
                                    onClick={(): void => {
                                        window.open(
                                            "https://addons.mozilla.org/en-US/firefox/addon/superhero-wallet/",
                                            "_blank",
                                        );
                                    }}
                                    className="sh_userOnboarding_download_option"
                                >
                                    <FirefoxIcon style={{ width: "22px", height: "22px", top: "7px", left: "18px" }} />
                                    <div className="sh_userOnboarding_download_option_label">from Firefox Add-ons</div>
                                </AccessibleButton>
                            </div>
                        </div>

                        <div>
                            <p>Say hello to Wallet Bot and connect your Superhero Wallet:</p>
                            <AccessibleButton
                                onClick={(): void => {
                                    startDmOnFirstMessage(cli, [
                                        new DirectoryMember({
                                            user_id: botAccounts?.superheroBot || "",
                                        }),
                                    ]);
                                }}
                                kind="primary"
                                className="sh_userOnboarding_btn"
                            >
                                Chat With Wallet Bot
                            </AccessibleButton>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
