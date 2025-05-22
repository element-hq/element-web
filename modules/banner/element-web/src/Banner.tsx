/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type FC } from "react";
import styled from "styled-components";
import { type Api } from "@element-hq/element-web-module-api";
import { Heading } from "@vector-im/compound-web";

import { type ModuleConfig } from "./config";
import UniventionMenu from "./Univention/Menu";
import Menu from "./Menu";
import Logo from "./Logo.tsx";

const Root = styled.nav`
    height: ${({ theme }): string => theme.bannerHeight};
    background-color: ${({ theme }): string => theme.bannerBackgroundColor};
    border-bottom: "var(--cpd-border-width-1) solid var(--cpd-color-bg-subtle-primary)";
    display: flex;
    gap: var(--cpd-space-3x);
`;

const LogoContainer = styled.div`
    display: flex;
    padding: var(--cpd-space-3x) 0;
`;

interface Props {
    api: Api;
    logoUrl: string;
    href: string;
    menu: ModuleConfig["menu"];
}

const Banner: FC<Props> = ({ api, logoUrl, href, menu }) => {
    let menuJsx;
    switch (menu.type) {
        case "static": {
            menuJsx = <Menu api={api} config={menu} fallbackLogoUrl={logoUrl} />;
            break;
        }
        case "univention": {
            menuJsx = <UniventionMenu api={api} config={menu} fallbackLogoUrl={logoUrl} />;
            break;
        }
    }

    return (
        <Root>
            {menuJsx}
            <LogoContainer>
                <Logo api={api} src={logoUrl} href={href} height="100%" />
            </LogoContainer>
            <Heading size="sm" weight="medium" as="h1">
                {api.config.get("brand")}
            </Heading>
        </Root>
    );
};

export default Banner;
