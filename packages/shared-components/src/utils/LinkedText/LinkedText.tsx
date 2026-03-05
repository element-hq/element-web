/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Link, Text } from "@vector-im/compound-web";
import React, { useMemo, type ComponentProps } from "react";
import classNames from "classnames";
import Linkify from "linkify-react";

import type { Opts } from "linkifyjs";
import styles from "./LinkedText.module.css";
import { generateLinkedTextOptions, type LinkedTextOptions } from "../linkify";

export type LinkedTextProps = ComponentProps<typeof Text> & LinkedTextOptions;

/**
 * A component that renders URLs as clickable links inside some plain text.
 *
 * @example
 * ```tsx
 * <LinkedText>
 *     I love working on https://matrix.org
 * </LinkedText>
 * ```
 */
export function LinkedText({
    children,
    className,
    userIdListener,
    roomAliasListener,
    urlListener,
    urlTargetTransformer,
    hrefTransformer,
    canClick,
    ...textProps
}: LinkedTextProps): React.ReactNode {
    const options = useMemo<Opts>(
        () => ({
            render: Link,
            ...generateLinkedTextOptions({
                canClick,
                urlListener,
                hrefTransformer,
                urlTargetTransformer,
                userIdListener,
                roomAliasListener,
            }),
        }),
        [canClick, urlListener, hrefTransformer, urlTargetTransformer, userIdListener, roomAliasListener],
    );

    return (
        <Linkify className={classNames(styles.container, className)} as={Text} options={options} {...textProps}>
            {children}
        </Linkify>
    );
}
