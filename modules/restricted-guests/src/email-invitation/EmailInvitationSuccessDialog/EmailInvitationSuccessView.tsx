/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type JSX } from "react";
import { Flex, useViewModel } from "@element-hq/web-shared-components";
import { styled } from "styled-components";
import { BigIcon, Button, Heading, Text } from "@vector-im/compound-web";
import { CheckCircleSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { type Api } from "@element-hq/element-web-module-api";
import type { EmailInvitationSuccessViewModel } from "./types";

interface EmailInvitationSuccessViewProps {
    /** Module API */
    api: Api;
    /** View model */
    vm: EmailInvitationSuccessViewModel;
}

/**
 * Confirmation shown once the email invitations are sent, listing the invited emails.
 *
 * @example
 * ```tsx
 * <EmailInvitationSuccessView api={api} vm={vm} />
 * ```
 */
export function EmailInvitationSuccessView({ api, vm }: Readonly<EmailInvitationSuccessViewProps>): JSX.Element {
    const { emails } = useViewModel(vm);
    // Join the emails into a single string
    const emailsLine = emails.join(", ");

    return (
        <StyledContainer direction="column" gap="var(--cpd-space-4x)" justify="space-between" align="stretch">
            <Flex direction="column" gap="var(--cpd-space-8x)" align="center">
                <BigIcon kind="success">
                    <CheckCircleSolidIcon />
                </BigIcon>
                <Flex direction="column" gap="var(--cpd-space-2x)" align="center">
                    <StyledHeading forwardedAs="h1" size="md" weight="semibold">
                        {api.i18n.translate("invitation_email_dialog_success_title")}
                    </StyledHeading>
                    <StyledParagraph forwardedAs="p" direction="column" align="center">
                        <Text as="span" size="lg">
                            {api.i18n.translate(
                                "invitation_email_dialog_success_text",
                                { email: emailsLine },
                                {
                                    br: <br />,
                                    b: (t) => (
                                        <Email forwardedAs="span" size="lg" weight="medium">
                                            {t}
                                        </Email>
                                    ),
                                },
                            )}
                        </Text>
                        <Text as="span" size="lg">
                            {api.i18n.translate("invitation_email_dialog_success_expire")}
                        </Text>
                    </StyledParagraph>
                </Flex>
            </Flex>
            <StyledButton onClick={vm.closeDialog}>
                {api.i18n.translate("invitation_email_dialog_success_done")}
            </StyledButton>
        </StyledContainer>
    );
}

const StyledContainer = styled(Flex)`
    margin-top: var(--cpd-space-6x);
    color: var(--cpd-color-text-primary);
`;

const StyledHeading = styled(Heading)`
    // Override default browser margin
    margin: 0;
`;

const StyledParagraph = styled(Flex)`
    color: var(--cpd-color-text-secondary);
    text-align: center;
    // Override default browser margin
    margin: 0;
`;

const Email = styled(Text)`
    color: var(--cpd-color-text-primary);
`;

const StyledButton = styled(Button)`
    margin-top: var(--cpd-space-10x);
`;
