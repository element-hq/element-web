/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React, {
    type JSX,
    type PropsWithChildren,
    type ComponentProps,
    type ComponentType,
    type SVGAttributes,
} from "react";
import { BigIcon, Heading } from "@vector-im/compound-web";
import classNames from "classnames";

interface EncryptionCardProps {
    /**
     * CSS class name to apply to the card.
     */
    className?: string;
    /**
     * The title of the card.
     */
    title: string;
    /**
     * The description of the card.
     */
    description?: string;
    /**
     * Whether this icon shows a destructive action.
     */
    destructive?: boolean;
    /**
     * Whether this icon shows a successful outcome. Ignored if `destructive` is set.
     */
    success?: boolean;
    /**
     * The icon to display.
     */
    Icon: ComponentType<SVGAttributes<SVGElement>>;
    /**
     * Whether the card is hosted in a dialog (logout and recovery key dialogs), which drops the
     * border and centers the copy.
     */
    dialog?: boolean;
}

/**
 * A styled card for encryption settings.
 */
export function EncryptionCard({
    title,
    description,
    className,
    destructive = false,
    success = false,
    Icon,
    dialog = false,
    children,
}: PropsWithChildren<EncryptionCardProps>): JSX.Element {
    let iconKind: ComponentProps<typeof BigIcon>["kind"] = "primary";
    if (destructive) {
        iconKind = "critical";
    } else if (success) {
        iconKind = "success";
    }

    return (
        <div
            className={classNames("mx_EncryptionCard", className, {
                "mx_EncryptionCard_noBorder mx_EncryptionCard_dialog": dialog,
            })}
        >
            <div className="mx_EncryptionCard_header">
                <BigIcon kind={iconKind}>
                    <Icon />
                </BigIcon>
                <Heading as="h2" size="sm" weight="semibold">
                    {title}
                </Heading>
                {description && <span>{description}</span>}
            </div>
            {children}
        </div>
    );
}
