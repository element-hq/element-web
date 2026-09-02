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

    a {
        display: contents;
        text-decoration: none;
    }

    h1 {
        align-self: center;
        color: ${({ theme }): string => theme.textColor};
    }
`;

interface Props {
    api: Api;
    logoUrl: string;
    href: string;
    menu: ModuleConfig["menu"];
    title: string;
}

const Banner: FC<Props> = ({ api, logoUrl, href, menu, title }) => {
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

    let headingJsx = (
        <>
            <Logo api={api} src={logoUrl} height="35px" />
            <Heading size="sm" weight="medium" as="h1">
                {title}
            </Heading>
        </>
    );
    if (href) {
        headingJsx = <a href={href}>{headingJsx}</a>;
    }

    return (
        <Root>
            {menuJsx}
            {headingJsx}
        </Root>
    );
};

export default Banner;
