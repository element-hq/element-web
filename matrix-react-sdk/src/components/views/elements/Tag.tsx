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

import React from "react";

import AccessibleButton from "./AccessibleButton";
import { Icon as CancelRounded } from "../../../../res/img/element-icons/cancel-rounded.svg";

interface IProps {
    icon?: () => JSX.Element;
    label: string;
    onDeleteClick?: () => void;
    disabled?: boolean;
}

export const Tag: React.FC<IProps> = ({ icon, label, onDeleteClick, disabled = false }) => {
    return (
        <div className="mx_Tag">
            {icon?.()}
            {label}
            {onDeleteClick && (
                <AccessibleButton
                    aria-label="Remove"
                    className="mx_Tag_delete"
                    onClick={onDeleteClick}
                    disabled={disabled}
                >
                    <CancelRounded />
                </AccessibleButton>
            )}
        </div>
    );
};
