/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { Tooltip } from "@vector-im/compound-web";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";

import { Flex } from "../../utils/Flex";
import { useI18n } from "../../utils/i18nContext";

/** Props for DateSeparatorButton. */
export interface DateSeparatorButtonProps {
    /** Visible date label shown in the separator button. */
    label: string;
    /** Controls tooltip visibility when parent manages open state. */
    tooltipOpen?: boolean;
    /** Extra CSS classes to apply to the component. */
    className?: string;
    /** Optional ref for the button container element. */
    buttonRef?: React.Ref<HTMLDivElement>;
}

/** Interactive date separator button that opens the jump-to-date menu. */
export function DateSeparatorButton({
    label,
    tooltipOpen,
    className,
    buttonRef,
    ...props
}: DateSeparatorButtonProps): React.ReactNode {
    const { translate: _t } = useI18n();
    return (
        <Tooltip description={_t("room|jump_to_date")} placement="right" open={tooltipOpen}>
            <Flex
                ref={buttonRef}
                data-testid="jump-to-date-separator-button"
                className={className}
                aria-live="off"
                aria-label={_t("room|jump_to_date")}
                role="button"
                tabIndex={0}
                {...props}
            >
                <h2 aria-hidden="true">{label}</h2>
                <ChevronDownIcon />
            </Flex>
        </Tooltip>
    );
}
