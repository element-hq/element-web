/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Flex } from "@element-hq/web-shared-components";
import type { JSX } from "react";
import { styled } from "styled-components";
import { Button, Tooltip } from "@vector-im/compound-web";
import { LinkIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import type { Api } from "@element-hq/element-web-module-api";

interface ButtonsRowProps {
    /** Module API */
    api: Api;
    /** Whether the send button is enabled. */
    canSendInvitations: boolean;
    /** Whether to show the copy link button instead of the cancel button. */
    canCopyLinkToClipboard: boolean;
    /** Called when the copy link button is clicked. */
    copyLinkToClipboard: () => void;
    /** Called when the cancel button is clicked. */
    closeDialog: () => void;
    /** Whether to display the copy link tooltip. */
    displayCopyTooltip: boolean;
}

/**
 * Buttons at the bottom of the invitation form: copy link or cancel, and send invitations.
 * The send button submits the surrounding form, so this must be rendered inside a form.
 *
 * @example
 * ```tsx
 * <ButtonsRow
 *     api={api}
 *     canSendInvitations={true}
 *     canCopyLinkToClipboard={true}
 *     copyLinkToClipboard={copyLinkToClipboard}
 *     closeDialog={closeDialog}
 * />
 * ```
 */
export function ButtonsRow({
    api,
    canSendInvitations,
    canCopyLinkToClipboard,
    copyLinkToClipboard,
    displayCopyTooltip,
    closeDialog,
}: Readonly<ButtonsRowProps>): JSX.Element {
    return (
        <Flex gap="var(--cpd-space-4x)">
            {canCopyLinkToClipboard ? (
                <Tooltip
                    placement="top"
                    open={displayCopyTooltip || undefined}
                    description={
                        displayCopyTooltip
                            ? api.i18n.translate("invitation_email_dialog_link_copied_tooltip")
                            : api.i18n.translate("invitation_email_dialog_copy_link_tooltip")
                    }
                >
                    <StyledButton
                        type="button"
                        Icon={LinkIcon}
                        kind="secondary"
                        size="lg"
                        onClick={copyLinkToClipboard}
                    >
                        {api.i18n.translate("invitation_email_dialog_copy_link")}
                    </StyledButton>
                </Tooltip>
            ) : (
                <StyledButton type="button" kind="secondary" size="lg" onClick={closeDialog}>
                    {api.i18n.translate("invitation_email_dialog_cancel")}
                </StyledButton>
            )}
            <StyledButton type="submit" kind="primary" size="lg" disabled={!canSendInvitations}>
                {api.i18n.translate("invitation_email_dialog_send_invitations")}
            </StyledButton>
        </Flex>
    );
}

const StyledButton = styled(Button)`
    flex: 1 1 50%;
`;
