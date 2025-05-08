/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type FC } from "react";
import styled, { ThemeProvider } from "styled-components";
import { type Api } from "@element-hq/element-web-module-api";

import { type ModuleConfig } from "./config";
import UniventionMenu from "./Univention/Menu";
import Menu from "./Menu";
import { theme } from "./theme";
import Logo from "./Logo.tsx";

const Root = styled.nav`
    background-color: ${({ theme }): string => theme.compound.color.bgCanvasDefault};
    border-bottom: ${({ theme }): string => theme.navbar.border};
    height: ${({ theme }): string => theme.navbar.height};
    display: grid;
    grid-template-columns: ${({ theme }): string => `${theme.navbar.triggerWidth} auto`};
    gap: 24px;
`;

const Main = styled.div`
    display: flex;
    align-items: center;
    grid-column: 2;
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
        <ThemeProvider theme={theme}>
            <Root>
                {menuJsx}
                <Main>
                    <Logo api={api} src={logoUrl} href={href} />
                </Main>
            </Root>
        </ThemeProvider>
    );
};

export default Banner;
