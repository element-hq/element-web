/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

interface Props {
    label: string;
}

export const enum SeparatorKind {
    None,
    Date,
    LateEvent,
}

/**
 * Generic timeline separator component to render within a MessagePanel
 *
 * @param label the accessible label string describing the separator
 * @param children the children to draw within the timeline separator
 */
const TimelineSeparator: React.FC<Props> = ({ label, children }) => {
    // ARIA treats <hr/>s as separators, here we abuse them slightly so manually treat this entire thing as one
    return (
        <div className="mx_TimelineSeparator" role="separator" aria-label={label}>
            <hr role="none" />
            {children}
            <hr role="none" />
        </div>
    );
};

export default TimelineSeparator;
