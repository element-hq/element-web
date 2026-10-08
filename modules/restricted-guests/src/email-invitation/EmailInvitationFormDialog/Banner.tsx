/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Flex } from "@element-hq/web-shared-components";
import type { ComponentType, JSX, SVGAttributes } from "react";
import { styled } from "styled-components";
import { Text } from "@vector-im/compound-web";
import { InfoIcon, HistoryIcon, VisibilityOffIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import type { Api } from "@element-hq/element-web-module-api";

interface BannerProps {
    /** Module API */
    api: Api;
    /** Whether invited guests can read the full chat history. */
    hasAccessToChatHistory: boolean;
}

/**
 * Banner telling the inviter that guests have limited access to the app, and whether they can read the chat history.
 *
 * @example
 * ```tsx
 * <Banner api={api} hasAccessToChatHistory={true} />
 * ```
 */
export function Banner({ api, hasAccessToChatHistory }: Readonly<BannerProps>): JSX.Element {
    return (
        <Container direction="column" gap="var(--cpd-space-2x)">
            <BannerRow Icon={InfoIcon} text={api.i18n.translate("invitation_email_dialog_banner_guest")} />
            {hasAccessToChatHistory ? (
                <BannerRow Icon={HistoryIcon} text={api.i18n.translate("invitation_email_dialog_banner_history_on")} />
            ) : (
                <BannerRow
                    Icon={VisibilityOffIcon}
                    text={api.i18n.translate("invitation_email_dialog_banner_history_off")}
                />
            )}
        </Container>
    );
}

const Container = styled(Flex)`
    background-color: var(--cpd-color-bg-info-subtle);
    color: var(--cpd-color-text-info-primary);
    padding: var(--cpd-space-3x) var(--cpd-space-4x);
    border-radius: 8px;
`;

interface BannerRowProps {
    /** Icon displayed before the text. */
    Icon: ComponentType<SVGAttributes<SVGElement>>;
    /** Text of the row. */
    text: string;
}

/**
 * A row of the banner: an icon followed by a text.
 */
function BannerRow({ Icon, text }: BannerRowProps): JSX.Element {
    return (
        <Flex gap="var(--cpd-space-2x)" align="center">
            <Icon width="16px" height="16px" fill="var(--cpd-color-icon-info-primary)" />
            <Text as="span" size="sm">
                {text}
            </Text>
        </Flex>
    );
}
