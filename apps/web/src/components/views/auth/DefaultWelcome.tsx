/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { Heading, Text } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig.ts";
import { Icon as MatrixIcon } from "../../../../res/img/matrix.svg";
import { Icon as LoginIcon } from "../../../../res/welcome/images/icon-sign-in.svg";
import { Icon as RegisterIcon } from "../../../../res/welcome/images/icon-create-account.svg";
import { Icon as RoomDirectoryIcon } from "../../../../res/welcome/images/icon-room-directory.svg";
import { MatrixClientPeg } from "../../../MatrixClientPeg.ts";

const DefaultWelcome: React.FC = () => {
    const brand = SdkConfig.get("brand");
    const branding = SdkConfig.getObject("branding");
    const logoUrl = branding.get("auth_header_logo_url");

    const showGuestFunctions = !!MatrixClientPeg.get();

    return (
        <div className="mx_DefaultWelcome">
            <a href={branding.get("logo_link_url")} target="_blank" rel="noopener">
                <img src={logoUrl} alt={brand} className="mx_DefaultWelcome_logo" />
            </a>
            <Heading as="h1" weight="semibold">
                {_t("welcome_to_element")}
            </Heading>
            <Text as="h2" size="sm">
                {_t(
                    "powered_by_matrix_with_logo",
                    {},
                    {
                        Logo: () => (
                            <a href="https://matrix.org" target="_blank" rel="noreferrer noopener" aria-label="Matrix">
                                <MatrixIcon
                                    className="mx_WelcomePage_logo"
                                    width="79"
                                    height="34"
                                    style={{ paddingLeft: "1px", verticalAlign: "middle" }}
                                />
                            </a>
                        ),
                    },
                )}
            </Text>

            <div className="mx_DefaultWelcome_buttons">
                <a href="#/login" className="mx_DefaultWelcome_buttons_login">
                    <LoginIcon />
                    {_t("action|sign_in")}
                </a>
                <a href="#/register" className="mx_DefaultWelcome_buttons_register">
                    <RegisterIcon />
                    {_t("action|create_account")}
                </a>
                {showGuestFunctions && (
                    <div>
                        <a href="#/directory" className="mx_DefaultWelcome_buttons_roomDirectory">
                            <RoomDirectoryIcon />
                            {_t("action|explore_rooms")}
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DefaultWelcome;
