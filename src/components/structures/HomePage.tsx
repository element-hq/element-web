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

import SdkConfig from "matrix-react-sdk/src/SdkConfig";
import AutoHideScrollbar from "matrix-react-sdk/src/components/structures/AutoHideScrollbar";
import EmbeddedPage from "matrix-react-sdk/src/components/structures/EmbeddedPage";
import AccessibleButton from "matrix-react-sdk/src/components/views/elements/AccessibleButton";
import { useMatrixClientContext } from "matrix-react-sdk/src/contexts/MatrixClientContext";
import { getHomePageUrl } from "matrix-react-sdk/src/utils/pages";
import * as React from "react";

import { Icon as ChatScreenShot } from "../../../res/themes/superhero/img/arts/chat-screenshot.svg";
import { Icon as ChromeIcon } from "../../../res/themes/superhero/img/icons/chrome.svg";
import { Icon as FirefoxIcon } from "../../../res/themes/superhero/img/icons/firefox.svg";
import { Icon as SuperheroLogo } from "../../../res/themes/superhero/img/logos/superhero-logo.svg";

interface IProps {
    justRegistered?: boolean;
}

const HomePage: React.FC<IProps> = () => {
    const cli = useMatrixClientContext();
    const config = SdkConfig.get();
    const pageUrl = getHomePageUrl(config, cli);

    if (pageUrl) {
        return <EmbeddedPage className="mx_HomePage" url={pageUrl} scrollbar={true} />;
    }

    return (
        <AutoHideScrollbar className="mx_HomePage mx_HomePage_default" element="main">
            <div className="mx_HomePage_default_wrapper">
                <ChatScreenShot />
                <div className="mx_HomePage_title">
                    <SuperheroLogo />
                    <div>is so much better with our Wallet</div>
                </div>
                <div className="mx_HomePage_default_buttons_title">Download extension for your browser</div>
                <div className="mx_HomePage_default_buttons">
                    <AccessibleButton
                        onClick={(): void => {
                            window.open("https://addons.mozilla.org/en-US/firefox/addon/superhero-wallet/", "_blank");
                        }}
                        className="mx_HomePage_button_custom"
                    >
                        <FirefoxIcon />
                        from Firefox Add-ons
                    </AccessibleButton>
                    <AccessibleButton
                        onClick={(): void => {
                            window.open(
                                "https://chromewebstore.google.com/detail/superhero/mnhmmkepfddpifjkamaligfeemcbhdne",
                                "_blank",
                            );
                        }}
                        className="mx_HomePage_button_custom"
                    >
                        <ChromeIcon />
                        from Chrome Web Store
                    </AccessibleButton>
                </div>
            </div>
        </AutoHideScrollbar>
    );
};

export default HomePage;
