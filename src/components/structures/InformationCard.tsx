/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type PropsWithChildren, type ComponentType, type SVGAttributes } from "react";
import { BigIcon, Heading } from "@vector-im/compound-web";
import classNames from "classnames";

interface InformationCardProps {
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
     * Whether the component should have a border
     */
    border?: boolean;
    /**
     * The icon to display.
     */
    Icon: ComponentType<SVGAttributes<SVGElement>>;
}

/**
 * A component to present action buttons at the bottom of an {@link EncryptionCard}
 * (mostly as somewhere for the common CSS to live).
 */
export function InformationCardButtons({ children }: PropsWithChildren): JSX.Element {
    return <div className="mx_InformationCard_buttons">{children}</div>;
}


/**
 * A styled card for encryption settings.
 * Note: This was previously known as the EncryptionCard
 */
export function InformationCard({
    title,
    description,
    className,
    border = true,
    destructive = false,
    Icon,
    children,
}: PropsWithChildren<InformationCardProps>): JSX.Element {
    return (
        <div className={classNames("mx_InformationCard", className, border && "mx_InformationCard_border")}>
            <div className="mx_InformationCard_header">
                <BigIcon destructive={destructive}>
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
