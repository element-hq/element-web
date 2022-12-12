/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { DetailedHTMLProps, AnchorHTMLAttributes } from "react";
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
