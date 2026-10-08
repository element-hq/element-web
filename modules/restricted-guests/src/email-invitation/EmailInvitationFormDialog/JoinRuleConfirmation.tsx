/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Api } from "@element-hq/element-web-module-api";
import { Flex } from "@element-hq/web-shared-components";
import { type JSX } from "react";
import { styled } from "styled-components";
import { Form, Text } from "@vector-im/compound-web";

interface JoinRuleConfirmationProps {
    /** Module API */
    api: Api;
    /** Whether the checkbox confirming the join rule change is checked. */
    isJoinRuleChangeConfirmed: boolean;
    /** Called when the checkbox is clicked. */
    toggleJoinRuleConfirmed: () => void;
}

/**
 * Asks the inviter to confirm changing the room join rule to "Ask to join", so that guests can join the room.
 * The checkbox is a form field, so this must be rendered inside a form.
 *
 * @example
 * ```tsx
 * <JoinRuleConfirmation
 *     api={api}
 *     isJoinRuleChangeConfirmed={false}
 *     toggleJoinRuleConfirmed={toggleJoinRuleConfirmed}
 * />
 * ```
 */
export function JoinRuleConfirmation({
    api,
    isJoinRuleChangeConfirmed,
    toggleJoinRuleConfirmed,
}: Readonly<JoinRuleConfirmationProps>): JSX.Element {
    return (
        <Container direction="column" gap="var(--cpd-space-6x)">
            <Flex direction="column" gap="var(--cpd-space-1x)">
                <Text as="span" weight="semibold">
                    {api.i18n.translate("invitation_email_dialog_join_rule_confirmation_title")}
                </Text>
                <SecondaryText forwardedAs="span">
                    {api.i18n.translate("invitation_email_dialog_join_rule_confirmation_text")}
                </SecondaryText>
            </Flex>
            <Form.InlineField
                name="joinRule"
                control={<Form.CheckboxControl checked={isJoinRuleChangeConfirmed} onClick={toggleJoinRuleConfirmed} />}
            >
                <Form.Label>
                    {api.i18n.translate("invitation_email_dialog_join_rule_confirmation_checkbox_label")}
                </Form.Label>
            </Form.InlineField>
        </Container>
    );
}

const Container = styled(Flex)`
    padding: var(--cpd-space-3x);
    border-radius: 8px;
    border: 1px solid var(--cpd-color-border-interactive-secondary);
`;

const SecondaryText = styled(Text)`
    color: var(--cpd-color-text-secondary);
`;
