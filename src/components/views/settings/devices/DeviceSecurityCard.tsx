/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import classNames from "classnames";
import React from "react";

import { Icon as VerifiedIcon } from "../../../../../res/img/e2e/verified.svg";
import { Icon as UnverifiedIcon } from "../../../../../res/img/e2e/warning.svg";
import { Icon as InactiveIcon } from "../../../../../res/img/element-icons/settings/inactive.svg";
import { DeviceSecurityVariation } from "./types";
interface Props {
    variation: DeviceSecurityVariation;
    heading: string;
    description: string | React.ReactNode;
    children?: React.ReactNode;
}

const VariationIcon: Record<DeviceSecurityVariation, React.FC<React.SVGProps<SVGSVGElement>>> = {
    [DeviceSecurityVariation.Inactive]: InactiveIcon,
    [DeviceSecurityVariation.Verified]: VerifiedIcon,
    [DeviceSecurityVariation.Unverified]: UnverifiedIcon,
    [DeviceSecurityVariation.Unverifiable]: UnverifiedIcon,
};

const DeviceSecurityIcon: React.FC<{ variation: DeviceSecurityVariation }> = ({ variation }) => {
    const Icon = VariationIcon[variation];
    return (
        <div className={classNames("mx_DeviceSecurityCard_icon", variation)}>
            <Icon height={16} width={16} />
        </div>
    );
};

const DeviceSecurityCard: React.FC<Props> = ({ variation, heading, description, children }) => {
    return (
        <div className="mx_DeviceSecurityCard">
            <DeviceSecurityIcon variation={variation} />
            <div className="mx_DeviceSecurityCard_content">
                <p className="mx_DeviceSecurityCard_heading">{heading}</p>
                <p className="mx_DeviceSecurityCard_description">{description}</p>
                {!!children && <div className="mx_DeviceSecurityCard_actions">{children}</div>}
            </div>
        </div>
    );
};

export default DeviceSecurityCard;
