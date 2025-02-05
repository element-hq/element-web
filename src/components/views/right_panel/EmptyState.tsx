/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentType } from "react";
import { Text } from "@vector-im/compound-web";

import { Flex } from "../../utils/Flex";

interface Props {
    Icon: ComponentType<React.SVGAttributes<SVGElement>>;
    title: string;
    description: string;
}

const EmptyState: React.FC<Props> = ({ Icon, title, description }) => {
    return (
        <Flex className="mx_EmptyState" direction="column" gap="var(--cpd-space-4x)" align="center" justify="center">
            <Icon width="32px" height="32px" />
            <Text size="lg" weight="semibold">
                {title}
            </Text>
            <Text size="md" weight="regular">
                {description}
            </Text>
        </Flex>
    );
};

export default EmptyState;
