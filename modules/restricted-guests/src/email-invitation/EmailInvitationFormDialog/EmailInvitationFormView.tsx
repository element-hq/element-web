/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type JSX } from "react";
import { Flex, PillInput, useViewModel } from "@element-hq/web-shared-components";
import { styled } from "styled-components";
import { Form } from "@vector-im/compound-web";
import { type Api } from "@element-hq/element-web-module-api";
import { Banner } from "./Banner";
import { JoinRuleConfirmation } from "./JoinRuleConfirmation";
import { ButtonsRow } from "./ButtonsRow";
import type { EmailInvitationFormViewModel } from "./types";
import { EmailPill } from "./EmailPill";

interface EmailInvitationFormViewProps {
    /** Module API */
    api: Api;
    /** View model */
    vm: EmailInvitationFormViewModel;
}

/**
 * Invitation form of the email invitation dialog.
 *
 * @example
 * ```tsx
 * <EmailInvitationFormView api={api} vm={vm} />
 * ```
 */
export function EmailInvitationFormView({ api, vm }: Readonly<EmailInvitationFormViewProps>): JSX.Element {
    const {
        hasAccessToChatHistory,
        isJoinRuleChangeRequired,
        isJoinRuleChangeConfirmed,
        canSendInvitations,
        canCopyLinkToClipboard,
        displayCopyTooltip,
        emails,
    } = useViewModel(vm);

    return (
        <StyledForm
            onSubmit={(e) => {
                e.preventDefault();
                vm.sendInvitations();
            }}
        >
            <Flex direction="column" align="stretch" gap="var(--cpd-space-4x)">
                <Banner api={api} hasAccessToChatHistory={hasAccessToChatHistory} />
                {isJoinRuleChangeRequired && (
                    <JoinRuleConfirmation
                        api={api}
                        isJoinRuleChangeConfirmed={isJoinRuleChangeConfirmed}
                        toggleJoinRuleConfirmed={vm.toggleJoinRuleConfirmed}
                    />
                )}
                <PillInput
                    inputProps={{
                        placeholder: api.i18n.translate("invitation_email_dialog_email_placeholder"),
                        onKeyDown: (evt) => {
                            if (evt.key === "Enter" || evt.key === " ") {
                                evt.preventDefault();
                                evt.stopPropagation();

                                vm.addEmail(evt.currentTarget.value);
                                evt.currentTarget.value = "";
                            }
                        },
                    }}
                >
                    {emails.map((email, i) => (
                        <EmailPill key={email.text} email={email} onClick={() => vm.removeEmail(i)} />
                    ))}
                </PillInput>
            </Flex>
            <ButtonsRow
                api={api}
                canSendInvitations={canSendInvitations}
                canCopyLinkToClipboard={canCopyLinkToClipboard}
                copyLinkToClipboard={() => void vm.copyLinkToClipboard()}
                closeDialog={vm.closeDialog}
                displayCopyTooltip={displayCopyTooltip}
            />
        </StyledForm>
    );
}

const StyledForm = styled(Form.Root)`
    display: flex;
    flex-direction: column;
    gap: var(--cpd-space-10x);
    align-items: stretch;
    justify-content: space-between;
    margin-top: var(--cpd-space-6x);
    color: var(--cpd-color-text-primary);
`;
