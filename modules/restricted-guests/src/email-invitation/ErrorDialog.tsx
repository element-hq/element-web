/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Api, DialogProps } from "@element-hq/element-web-module-api";
import { Flex } from "@element-hq/web-shared-components";
import { Button, Text } from "@vector-im/compound-web";
import type { JSX } from "react";
import { styled } from "styled-components";

interface ErrorDialogProps extends DialogProps<void> {
    /** Module API */
    api: Api;
    /** Sentences explaining the error, each shown on its own line */
    lines: string[];
}

/**
 * Dialog showing an error message, one sentence per line, with an OK button to close it.
 * The title is set by the caller when opening the dialog.
 *
 * @example
 * ```tsx
 * <ErrorDialog
 *     api={api}
 *     lines={["An error occurred when attempting to send the invite.", "Please try again."]}
 *     onSubmit={onSubmit}
 * />
 * ```
 */
export function ErrorDialog({ api, lines, onSubmit }: Readonly<ErrorDialogProps>): JSX.Element {
    return (
        <StyledContainer direction="column" gap="var(--cpd-space-8x)" justify="space-between" align="stretch">
            <StyledParagraph forwardedAs="p" direction="column">
                {lines.map((line) => (
                    <Text as="span" size="lg" key={line}>
                        {line}
                    </Text>
                ))}
            </StyledParagraph>
            <Button size="lg" onClick={() => onSubmit()}>
                {api.i18n.translate("error_dialog_ok")}
            </Button>
        </StyledContainer>
    );
}

const StyledContainer = styled(Flex)`
    padding-top: var(--cpd-space-6x);
`;

const StyledParagraph = styled(Flex)`
    // Override default browser margin
    margin: 0;
`;
