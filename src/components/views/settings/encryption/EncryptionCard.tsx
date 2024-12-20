/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React, { JSX, PropsWithChildren } from "react";
import { BigIcon, Heading } from "@vector-im/compound-web";
import KeyIcon from "@vector-im/compound-design-tokens/assets/web/icons/key-solid";
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
    description: string;
}

/**
 * A styled card for encryption settings.
 */
export function EncryptionCard({
    title,
    description,
    className,
    children,
}: PropsWithChildren<EncryptionCardProps>): JSX.Element {
    return (
        <div className={classNames("mx_EncryptionCard", className)}>
            <div className="mx_EncryptionCard_header">
                <BigIcon>
                    <KeyIcon />
                </BigIcon>
                <Heading as="h2" size="sm" weight="semibold">
                    {title}
                </Heading>
                <span>{description}</span>
            </div>
            {children}
        </div>
    );
}
