/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 New Vector Ltd

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

import React, { ReactElement } from "react";
import SdkConfig from "matrix-react-sdk/src/SdkConfig";

import { _t } from "../../../languageHandler";

const VectorAuthFooter = (): ReactElement => {
    const brandingConfig = SdkConfig.getObject("branding");
    const links = brandingConfig?.get("auth_footer_links") ?? [
        { text: "Blog", url: "https://element.io/blog" },
        { text: "Twitter", url: "https://twitter.com/element_hq" },
        { text: "GitHub", url: "https://github.com/vector-im/element-web" },
    ];

    const authFooterLinks: JSX.Element[] = [];
    for (const linkEntry of links) {
        authFooterLinks.push(
            <a href={linkEntry.url} key={linkEntry.text} target="_blank" rel="noreferrer noopener">
                {linkEntry.text}
            </a>,
        );
    }

    return (
        <footer className="mx_AuthFooter" role="contentinfo">
            {authFooterLinks}
            <a href="https://matrix.org" target="_blank" rel="noreferrer noopener">
                {_t("powered_by_matrix")}
            </a>
        </footer>
    );
};

export default VectorAuthFooter;
