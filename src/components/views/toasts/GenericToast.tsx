/*
Copyright 2020-2021 The Matrix.org Foundation C.I.C.

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

import React, { ComponentType, ReactNode } from "react";
import { Button } from "@vector-im/compound-web";

import { XOR } from "../../../@types/common";

export interface IProps {
    description: ReactNode;
    detail?: ReactNode;
    primaryLabel: string;
    PrimaryIcon?: ComponentType<React.SVGAttributes<SVGElement>>;

    onPrimaryClick(): void;
}

interface IPropsExtended extends IProps {
    secondaryLabel: string;
    SecondaryIcon?: ComponentType<React.SVGAttributes<SVGElement>>;
    destructive?: "primary" | "secondary";
    onSecondaryClick(): void;
}

const GenericToast: React.FC<XOR<IPropsExtended, IProps>> = ({
    description,
    detail,
    primaryLabel,
    PrimaryIcon,
    secondaryLabel,
    SecondaryIcon,
    destructive,
    onPrimaryClick,
    onSecondaryClick,
}) => {
    const detailContent = detail ? <div className="mx_Toast_detail">{detail}</div> : null;

    return (
        <div>
            <div className="mx_Toast_description">
                {description}
                {detailContent}
            </div>
            <div className="mx_Toast_buttons" aria-live="off">
                {onSecondaryClick && secondaryLabel && (
                    <Button
                        onClick={onSecondaryClick}
                        kind={destructive === "secondary" ? "destructive" : "secondary"}
                        Icon={SecondaryIcon}
                        size="sm"
                    >
                        {secondaryLabel}
                    </Button>
                )}
                <Button
                    onClick={onPrimaryClick}
                    kind={destructive === "primary" ? "destructive" : "primary"}
                    Icon={PrimaryIcon}
                    size="sm"
                >
                    {primaryLabel}
                </Button>
            </div>
        </div>
    );
};

export default GenericToast;
