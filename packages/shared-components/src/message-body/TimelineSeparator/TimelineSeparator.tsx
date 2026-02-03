/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type PropsWithChildren } from "react";
import classNames from "classnames";

import styles from "./TimelineSeparator.module.css";

/**
 * Timeline separator props
 */
export interface TimelineSeparatorProps {
    /**
     * Accessible label for the separator (for example: "Today", "Yesterday", or a date).
     */
    label: string;
    /**
     * Optional children to render inside the timeline separator
     */
    children?: PropsWithChildren["children"];
}

/**
 * Generic timeline separator component to render within a MessagePanel
 *
 * @param label the accessible label string describing the separator
 * @param children the children to draw within the timeline separator
 */
const TimelineSeparator: React.FC<TimelineSeparatorProps> = ({ label, children }) => {
    // ARIA treats <hr/>s as separators, here we abuse them slightly so manually treat this entire thing as one
    return (
        <Flex
            className={classNames("mx_TimelineSeparator", styles.timelineSeparator)}
            role="separator"
            aria-label={label}
        >
            <hr role="none" />
            {children}
            <hr role="none" />
        </div>
    );
};

export default TimelineSeparator;
