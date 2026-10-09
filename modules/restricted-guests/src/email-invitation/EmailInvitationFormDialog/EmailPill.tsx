/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { memo, type JSX, type MouseEventHandler } from "react";
import { type Email } from "./types";
import { Flex, Pill } from "@element-hq/web-shared-components";
import { ErrorIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { styled } from "styled-components";

interface EmailPillProps {
    /** The email to show */
    email: Email;
    /** Called when the remove button of the pill is clicked */
    onClick: MouseEventHandler<HTMLButtonElement>;
}

/**
 * Pill showing an email entered in the invitation form, with a button to remove it.
 * Invalid emails are shown in red with an error icon.
 *
 * @example
 * ```tsx
 * <EmailPill email={{ text: "alice@example.com", isValid: true }} onClick={onRemove} />
 * ```
 */
export const EmailPill = memo(function EmailPill({ email, onClick }: Readonly<EmailPillProps>): JSX.Element {
    switch (email.isValid) {
        case true:
            return (
                <Pill label={email.text} onClick={onClick}>
                    <StyledEmailIcon align="center" justify="center" aria-hidden="true">
                        @
                    </StyledEmailIcon>
                </Pill>
            );
        case false:
            return (
                <ErrorPill label={email.text} onClick={onClick}>
                    <ErrorIcon width={20} height={20} color="var(--cpd-color-icon-critical-primary)" />
                </ErrorPill>
            );
    }
});

const StyledEmailIcon = styled(Flex)`
    border-radius: 100%;
    width: 20px;
    height: 20px;
    background-color: var(--cpd-color-bg-decorative-1);
    color: var(--cpd-color-text-decorative-1);
    font-size: 11px;
    font-weight: 700;
`;

const ErrorPill = styled(Pill)`
    && {
        background-color: var(--cpd-color-bg-critical-subtle);
    }

    // Override the text color
    && > span {
        color: var(--cpd-color-text-critical-primary);
    }

    // Override the icon color
    button * {
        color: var(--cpd-color-icon-critical-primary) !important;
    }
`;
