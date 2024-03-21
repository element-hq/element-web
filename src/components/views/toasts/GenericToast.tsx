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

import React, { ReactNode } from "react";

import AccessibleButton from "../elements/AccessibleButton";
import { XOR } from "../../../@types/common";

export interface IProps {
    description: ReactNode;
    detail?: ReactNode;
    acceptLabel: string;

    onAccept(): void;
}

interface IPropsExtended extends IProps {
    rejectLabel: string;
    onReject(): void;
}

const GenericToast: React.FC<XOR<IPropsExtended, IProps>> = ({
    description,
    detail,
    acceptLabel,
    rejectLabel,
    onAccept,
    onReject,
}) => {
    const detailContent = detail ? <div className="mx_Toast_detail">{detail}</div> : null;

    return (
        <div>
            <div className="mx_Toast_description">
                {description}
                {detailContent}
            </div>
            <div className="mx_Toast_buttons" aria-live="off">
                {onReject && rejectLabel && (
                    <AccessibleButton kind="danger_outline" onClick={onReject}>
                        {rejectLabel}
                    </AccessibleButton>
                )}
                <AccessibleButton onClick={onAccept} kind="primary">
                    {acceptLabel}
                </AccessibleButton>
            </div>
        </div>
    );
};

export default GenericToast;
