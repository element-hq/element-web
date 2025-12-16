/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import AccessibleButton from "../views/elements/AccessibleButton";

const SpacePillButton: React.FC<{
    title: string;
    icon: JSX.Element;
    description: string;
    onClick(): void;
}> = ({ title, icon, description, onClick }) => {
    return (
        <AccessibleButton className="mx_SpacePillButton" onClick={onClick}>
            {icon}
            {title}
            <div>{description}</div>
        </AccessibleButton>
    );
};

export default SpacePillButton;
