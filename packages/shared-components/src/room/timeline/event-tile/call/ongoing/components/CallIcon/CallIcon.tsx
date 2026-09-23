/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { CallType } from "../../../common";
import { Flex } from "../../../../../../../core/utils/Flex";
import styles from "./CallIcon.module.css";
import { Icon } from "../Icon/Icon";

interface Props {
    /**
     * The type of call.
     */
    callType: CallType;
}

/**
 * Common call icon component that is used by ongoing call tiles.
 */
export function CallIcon(props: Props): React.ReactNode {
    return (
        <Flex align="center" justify="center" className={styles.container}>
            <Icon classNames={styles.icon} callType={props.callType} height={20} width={20} />
        </Flex>
    );
}
