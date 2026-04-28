/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Link, Text } from "@vector-im/compound-web";
import React, { type ComponentProps } from "react";
import classNames from "classnames";
import Linkify from "linkify-react";

import styles from "./LinkedText.module.css";
import { generateLinkedTextOptions } from "../linkify";
import { useLinkedTextContext } from "./LinkedTextContext";

export type LinkedTextProps = ComponentProps<typeof Text> & {
    /**
     * Handler for when a link within the component is clicked. This will run
     * *before* any LinkedTextContext handlers are run.
     * @param ev The event raised by the click.
     */
    onLinkClick?: (ev: MouseEvent) => void;
};
/**
 * A component that renders URLs as clickable links inside some plain text.
 *
 * Requires a `<LinkedTextContext.Provider>`
 *
 * @example
 * ```tsx
 * <LinkedTextContext.Provider value={...}>
 *     <LinkedText>
 *         I love working on https://matrix.org
 *     </LinkedText>
 * </LinkedTextContext.Provider>
 * ```
 */
export function LinkedText({ children, className, onLinkClick, ...textProps }: LinkedTextProps): React.ReactNode {
    const options = useLinkedTextContext();
    const linkifyOptions = generateLinkedTextOptions({ ...options, onLinkClick });
    return (
        <Linkify
            className={classNames(styles.container, className)}
            as={Text}
            options={{ ...linkifyOptions, render: Link }}
            {...textProps}
        >
            {children}
        </Linkify>
    );
}
