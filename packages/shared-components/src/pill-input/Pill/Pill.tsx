/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type MouseEventHandler, type JSX, type PropsWithChildren, type HTMLAttributes, useId } from "react";
import classNames from "classnames";
import { IconButton } from "@vector-im/compound-web";
import CloseIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";

import { Flex } from "../../utils/Flex";
import styles from "./Pill.module.css";
import { useI18n } from "../../utils/i18nContext";

export interface PillProps extends Omit<HTMLAttributes<HTMLDivElement>, "onClick"> {
    /**
     * The text label to display inside the pill.
     */
    label: string;
    /**
     * Optional click handler for a close button.
     * If provided, a close button will be rendered.
     */
    onClick?: MouseEventHandler<HTMLButtonElement>;
}

/**
 * A pill component that can display a label and an optional close button.
 * The badge can also contain child elements, such as icons or avatars.
 *
 * @example
 * ```tsx
 * <Pill label="New" onClick={() => console.log("Closed")}>
 *     <SomeIcon />
 * </Pill>
 * ```
 */
export function Pill({ className, children, label, onClick, ...props }: PropsWithChildren<PillProps>): JSX.Element {
    const id = useId();
    const { translate: _t } = useI18n();

    return (
        <Flex
            display="inline-flex"
            gap="var(--cpd-space-1-5x)"
            align="center"
            className={classNames(styles.pill, className)}
            {...props}
        >
            {children}
            <span id={id} className={styles.label}>
                {label}
            </span>
            {onClick && (
                <IconButton
                    aria-describedby={id}
                    size="16px"
                    onClick={onClick}
                    aria-label={_t("action|delete")}
                    className="mx_Dialog_nonDialogButton"
                >
                    <CloseIcon color="var(--cpd-color-icon-tertiary)" />
                </IconButton>
            )}
        </Flex>
    );
}
