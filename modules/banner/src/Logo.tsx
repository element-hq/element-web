/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type FC } from "react";
import styled from "styled-components";
import { type Api } from "@element-hq/element-web-module-api";

const Image = styled.img<{
    height?: string;
}>`
    align-self: center;
    height: ${({ height }): string => height ?? "32px"};
`;

interface Props {
    api: Api;
    src: string;
    height?: string;
}

const Logo: FC<Props> = ({ api, src, height }) => {
    return <Image alt={api.i18n.translate("logo_alt")} src={src} height={height} />;
};

export default Logo;
