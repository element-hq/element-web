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

import AccessibleButton from "../../../components/views/elements/AccessibleButton";

interface Props {
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    label: string;
    onClick: () => void;
}

export const SeekButton: React.FC<Props> = ({ onClick, icon: Icon, label }) => {
    return (
        <AccessibleButton kind="secondary_content" onClick={onClick} aria-label={label}>
            <Icon className="mx_Icon mx_Icon_24" />
        </AccessibleButton>
    );
};
