/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Link, Text } from "@vector-im/compound-web";
import React, { type ComponentProps } from "react";
import classNames from "classnames";

import type { Opts } from "linkifyjs";
import styles from "./LinkedText.module.css";
import { LinkifyComponent, LinkifyMatrixOpaqueIdType } from "../linkify";

type Props = ComponentProps<typeof Text>;

const options: Opts = {
    render: Link,
    target: "_blank",
    rel: "noreferrer noopener",
    defaultProtocol: "https",
    // By default, ignore Matrix ID types.
    // Other applications may implement their own version of LinkifyComponent.
    // In the future, shared-components may fully implement this logic.
    validate: (_value, type: string) =>
        ![LinkifyMatrixOpaqueIdType.RoomAlias, LinkifyMatrixOpaqueIdType.UserId].includes(
            type as LinkifyMatrixOpaqueIdType,
        ),
};
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
export function LinkedText({ children, className, ...textProps }: Props): React.ReactNode {
    return (
        <LinkifyComponent
            className={classNames(styles.container, className)}
            as={Text}
            options={options}
            {...textProps}
        >
            {children}
        </LinkifyComponent>
    );
}
