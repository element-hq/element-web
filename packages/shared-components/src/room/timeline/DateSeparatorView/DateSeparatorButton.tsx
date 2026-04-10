/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { forwardRef } from "react";
import { Heading, Tooltip } from "@vector-im/compound-web";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";

import { Flex } from "../../../core/utils/Flex";
import { useI18n } from "../../../core/i18n/i18nContext";

/** Props for DateSeparatorButton. */
export interface DateSeparatorButtonProps {
    /** Visible date label shown in the separator button. */
    label: string;
    /** Controls tooltip visibility when parent manages open state. */
    tooltipOpen?: boolean;
    /** Extra CSS classes to apply to the component. */
    className?: string;
    /** Called when the pointer enters the button trigger. */
    onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
    /** Called when the pointer leaves the button trigger. */
    onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
    /** Called when the button trigger receives focus. */
    onFocus?: React.FocusEventHandler<HTMLDivElement>;
    /** Called when the button trigger loses focus. */
    onBlur?: React.FocusEventHandler<HTMLDivElement>;
}

/** Interactive date separator button that forwards its ref to the underlying trigger element used by Compound Menu. */
export const DateSeparatorButton = forwardRef<HTMLDivElement, DateSeparatorButtonProps>(function DateSeparatorButton(
    { label, tooltipOpen, className, ...props },
    forwardedRef,
): React.ReactNode {
    const { translate: _t } = useI18n();

    return (
        <Tooltip description={_t("room|jump_to_date")} placement="right" open={tooltipOpen}>
            <Flex
                ref={forwardedRef}
                data-testid="jump-to-date-separator-button"
                className={className}
                aria-live="off"
                aria-label={_t("room|jump_to_date")}
                role="button"
                tabIndex={0}
                {...props}
            >
                <Heading as="h2" size="lg" aria-hidden="true">
                    {label}
                </Heading>
                <ChevronDownIcon />
            </Flex>
        </Tooltip>
    );
});
