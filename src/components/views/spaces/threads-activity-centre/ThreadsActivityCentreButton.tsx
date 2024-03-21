/*
 *
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * /
 */

import React, { ComponentProps, forwardRef } from "react";
import { Icon } from "@vector-im/compound-design-tokens/icons/threads-solid.svg";
import classNames from "classnames";
import { IconButton, Text, Tooltip } from "@vector-im/compound-web";

import { _t } from "../../../../languageHandler";
import { NotificationLevel } from "../../../../stores/notifications/NotificationLevel";
import { notificationLevelToIndicator } from "../../../../utils/notifications";

interface ThreadsActivityCentreButtonProps extends ComponentProps<typeof IconButton> {
    /**
     * Display the `Treads` label next to the icon.
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
    function ThreadsActivityCentreButton({ displayLabel, notificationLevel, ...props }, ref): React.JSX.Element {
        // Disable tooltip when the label is displayed
        const openTooltip = displayLabel ? false : undefined;

        return (
            <Tooltip label={_t("common|threads")} side="right" open={openTooltip}>
                <IconButton
                    aria-label={_t("common|threads")}
                    className={classNames("mx_ThreadsActivityCentreButton", { expanded: displayLabel })}
                    indicator={notificationLevelToIndicator(notificationLevel)}
                    {...props}
                    ref={ref}
                >
                    <>
                        <Icon className="mx_ThreadsActivityCentreButton_Icon" />
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
