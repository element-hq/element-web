/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode } from "react";

/**
 * Joins an array into one value with a joiner. E.g. join(["hello", "world"], " ") -> <>hello world</>
 * @param array the array of element to join
 * @param joiner the string/JSX.Element to join with
 * @returns the joined array
 */
export function jsxJoin(array: ReactNode[], joiner?: string | JSX.Element): JSX.Element {
    return (
        <>
            {array.map((element, index) => (
                <React.Fragment key={index}>
                    {element}
                    {index === array.length - 1 ? null : joiner}
                </React.Fragment>
            ))}
        </>
    );
}
