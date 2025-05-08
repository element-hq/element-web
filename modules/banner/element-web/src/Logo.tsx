/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type FC } from "react";
import styled from "styled-components";
import { type Api } from "@element-hq/element-web-module-api";

const Anchor = styled.a`
    display: flex;
`;

const Image = styled.img`
    height: ${({ theme }) => theme.navbar.logoHeight};
    align-self: center;
`;

interface Props {
    api: Api;
    src: string;
    href?: string;
}

const Logo: FC<Props> = ({ api, src, href }) => {
    const img = <Image alt={api.i18n.translate("Portal logo")} src={src} />;

    if (!href) return img;

    return (
        <Anchor aria-label={api.i18n.translate("Show portal")} href={href}>
            {img}
        </Anchor>
    );
};

export default Logo;
