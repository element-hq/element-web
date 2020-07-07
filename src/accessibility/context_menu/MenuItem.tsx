/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import AccessibleButton from "../../components/views/elements/AccessibleButton";

interface IProps extends React.ComponentProps<typeof AccessibleButton> {
    label?: string;
}

// Semantic component for representing a role=menuitem
export const MenuItem: React.FC<IProps> = ({children, label, ...props}) => {
    return (
        <AccessibleButton {...props} role="menuitem" tabIndex={-1} aria-label={label}>
            { children }
        </AccessibleButton>
    );
};

