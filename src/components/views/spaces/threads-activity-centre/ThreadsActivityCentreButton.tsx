/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ComponentProps, forwardRef } from "react";
import ThreadsSolidIcon from "@vector-im/compound-design-tokens/assets/web/icons/threads-solid";
import classNames from "classnames";
import { IconButton, Text, Tooltip } from "@vector-im/compound-web";

import { _t } from "../../../../languageHandler";
import { type NotificationLevel } from "../../../../stores/notifications/NotificationLevel";
import { notificationLevelToIndicator } from "../../../../utils/notifications";

interface ThreadsActivityCentreButtonProps extends ComponentProps<typeof IconButton> {
    /**
     * Whether to disable the tooltip.
     */
    disableTooltip?: boolean;
    /**
     * Display the `Threads` label next to the icon.
     */
    displayLabel?: boolean;
    /**
     * The notification level of the threads.
     */
    notificationLevel: NotificationLevel;
}

/**
 * A button to open the thread activity centre.
 */
export const ThreadsActivityCentreButton = forwardRef<HTMLButtonElement, ThreadsActivityCentreButtonProps>(
    function ThreadsActivityCentreButton(
        { displayLabel, notificationLevel, disableTooltip, ...props },
        ref,
    ): React.JSX.Element {
        // Disable tooltip when the label is displayed
        const openTooltip = disableTooltip || displayLabel ? false : undefined;

        return (
            <Tooltip label={_t("common|threads")} placement="right" open={openTooltip}>
                <IconButton
                    aria-label={_t("common|threads")}
                    className={classNames("mx_ThreadsActivityCentreButton", { expanded: displayLabel })}
                    indicator={notificationLevelToIndicator(notificationLevel)}
                    {...props}
                    ref={ref}
                >
                    <>
                        <ThreadsSolidIcon className="mx_ThreadsActivityCentreButton_Icon" />
                        {/* This is dirty, but we need to add the label to the indicator icon */}
                        {displayLabel && (
                            <Text
                                className="mx_ThreadsActivityCentreButton_Text"
                                as="span"
                                size="md"
                                title={_t("common|threads")}
                            >
                                {_t("common|threads")}
                            </Text>
                        )}
                    </>
                </IconButton>
            </Tooltip>
        );
    },
);
