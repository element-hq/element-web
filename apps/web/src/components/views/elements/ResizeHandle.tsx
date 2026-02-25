/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react"; // eslint-disable-line no-unused-vars

//see src/resizer for the actual resizing code, this is just the DOM for the resize handle
interface IResizeHandleProps {
    vertical?: boolean;
    reverse?: boolean;
    id?: string;
    passRef?: React.RefObject<HTMLDivElement | null>;
}

const ResizeHandle: React.FC<IResizeHandleProps> = ({ vertical, reverse, id, passRef }) => {
    const classNames = ["mx_ResizeHandle"];
    if (vertical) {
        classNames.push("mx_ResizeHandle--vertical");
    } else {
        classNames.push("mx_ResizeHandle--horizontal");
    }
    if (reverse) {
        classNames.push("mx_ResizeHandle_reverse"); // required for the resizer of the third pinned widget to work
    }
    return (
        <div ref={passRef} className={classNames.join(" ")} data-id={id}>
            <div />
        </div>
    );
};

export default ResizeHandle;
