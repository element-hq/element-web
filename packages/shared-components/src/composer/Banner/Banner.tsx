/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import classNames from "classnames";
import React, {
    type MouseEventHandler,
    type ReactElement,
    type ReactNode,
    type PropsWithChildren,
    useMemo,
} from "react";
import { Button } from "@vector-im/compound-web";
import CheckCircleIcon from "@vector-im/compound-design-tokens/assets/web/icons/check-circle";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error-solid";
import InfoIcon from "@vector-im/compound-design-tokens/assets/web/icons/info";

import styles from "./Banner.module.css";
import { _t } from "../../utils/i18n";

interface BannerProps {
    /**
     * The type of the status banner.
     */
    type?: "success" | "info" | "critical";

    /**
     * The banner avatar.
     */
    avatar?: React.ReactNode;

    className?: string;

    /**
     * Actions presented to the user in the right-hand side of the banner alongside the dismiss button.
     */
    actions?: ReactNode;
    /**
     * Called when the user presses the "dismiss" button.
     */
    onClose?: MouseEventHandler<HTMLButtonElement>;
}

/**
 * A banner component used for displaying user-facing information above the message composer.
 *
 * @example
 * ```tsx
 *   <Banner  onClose={onCloseHandler} />
 * ```
 */
export function Banner({
    type,
    children,
    avatar,
    className,
    actions,
    onClose,
    ...props
}: PropsWithChildren<BannerProps>): ReactElement {
    const classes = classNames(styles.banner, className);

    const icon = useMemo(() => {
        switch (type) {
            case "critical":
                return <ErrorIcon fontSize={24} {...props} />;
            case "info":
                return <InfoIcon fontSize={24} {...props} />;
            case "success":
                return <CheckCircleIcon fontSize={24} {...props} />;
            default:
                return <InfoIcon fontSize={24} {...props} />;
        }
    }, [type, props]);

    return (
        <div {...props} className={classes} data-type={type}>
            <div className={styles.icon}>{avatar ?? icon}</div>
            <span className={styles.content}>{children}</span>
            <div className={styles.actions}>
                {actions}
                {onClose && (
                    <Button kind="secondary" size="sm" onClick={onClose}>
                        {_t("action|dismiss")}
                    </Button>
                )}
            </div>
        </div>
    );
}
