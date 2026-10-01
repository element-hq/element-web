/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import styles from "./TileContainer.module.css";
import { Flex } from "../../../../../../../core/utils/Flex";

/**
 * Common container inside which all ongoing call tiles render.
 */
export function TileContainer({ children }: React.PropsWithChildren): React.ReactNode {
    return (
        <Flex direction="row" align="center" className={styles.container}>
            {children}
        </Flex>
    );
}
