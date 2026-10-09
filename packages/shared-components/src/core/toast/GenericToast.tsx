/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentType, type JSX, type ReactNode } from "react";
import { Button } from "@vector-im/compound-web";

import styles from "./GenericToast.module.css";

interface GenericToastBaseProps {
    /**
     * The main body of the toast.
     */
    description: ReactNode;
    /**
     * Optional extra content rendered underneath the description.
     */
    detail?: ReactNode;
    /**
     * Label of the primary action button.
     */
    primaryLabel: string;
    /**
     * Optional icon rendered inside the primary action button.
     */
    PrimaryIcon?: ComponentType<React.SVGAttributes<SVGElement>>;
    /**
     * Called when the primary action button is clicked.
     */
    onPrimaryClick(this: void): void;
    /**
     * If set, this will override the max-width (of the description) making the toast wider or narrower than standard.
     */
    overrideWidth?: string;
}

interface GenericToastWithSecondaryProps extends GenericToastBaseProps {
    /**
     * Label of the secondary action button.
     */
    secondaryLabel: string;
    /**
     * Optional icon rendered inside the secondary action button.
     */
    SecondaryIcon?: ComponentType<React.SVGAttributes<SVGElement>>;
    /**
     * Which of the two buttons, if any, should be rendered as a destructive action.
     */
    destructive?: "primary" | "secondary";
    /**
     * Called when the secondary action button is clicked.
     */
    onSecondaryClick(this: void): void;
}

interface GenericToastWithoutSecondaryProps extends GenericToastBaseProps {
    secondaryLabel?: undefined;
    SecondaryIcon?: undefined;
    destructive?: undefined;
    onSecondaryClick?: undefined;
}

/**
 * Props for {@link GenericToast}. A secondary button is rendered only when both
 * `secondaryLabel` and `onSecondaryClick` are provided.
 */
export type GenericToastProps = GenericToastWithSecondaryProps | GenericToastWithoutSecondaryProps;

/**
 * The standard body of a toast: a description, optional detail and one or two action buttons.
 * Intended to be rendered inside a toast container which provides the frame, title and icon.
 *
 * @example
 * ```tsx
 * <GenericToast
 *     description="Something happened."
 *     primaryLabel="OK"
 *     onPrimaryClick={() => {}}
 *     secondaryLabel="Later"
 *     onSecondaryClick={() => {}}
 * />
 * ```
 */
export function GenericToast({
    description,
    detail,
    primaryLabel,
    PrimaryIcon,
    secondaryLabel,
    SecondaryIcon,
    destructive,
    onPrimaryClick,
    onSecondaryClick,
    overrideWidth,
}: GenericToastProps): JSX.Element {
    const detailContent = detail ? <div>{detail}</div> : null;

    return (
        <div>
            <div className={styles.description} style={{ maxWidth: overrideWidth }}>
                {description}
                {detailContent}
            </div>
            <div className={styles.buttons} aria-live="off" data-testid="toast-buttons">
                {onSecondaryClick && secondaryLabel && (
                    <Button
                        onClick={onSecondaryClick}
                        kind={destructive === "secondary" ? "destructive" : "secondary"}
                        Icon={SecondaryIcon}
                        size="md"
                    >
                        {secondaryLabel}
                    </Button>
                )}
                <Button
                    onClick={onPrimaryClick}
                    kind={destructive === "primary" ? "destructive" : "primary"}
                    Icon={PrimaryIcon}
                    size="md"
                >
                    {primaryLabel}
                </Button>
            </div>
        </div>
    );
}
