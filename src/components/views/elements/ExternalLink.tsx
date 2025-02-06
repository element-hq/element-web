/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type DetailedHTMLProps, type AnchorHTMLAttributes } from "react";
import classNames from "classnames";

interface Props extends DetailedHTMLProps<AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement> {}

/**
 * Simple link component that adds external link icon after link children
 */
const ExternalLink: React.FC<Props> = ({ children, className, ...rest }) => (
    <a target="_blank" rel="noreferrer noopener" {...rest} className={classNames("mx_ExternalLink", className)}>
        {children}
        <i className="mx_ExternalLink_icon" />
    </a>
);

export default ExternalLink;
