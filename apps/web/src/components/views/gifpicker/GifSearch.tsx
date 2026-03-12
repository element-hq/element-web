/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, type JSX, useCallback, useEffect, useRef } from "react";

import { _t } from "../../../languageHandler";

interface GifSearchProps {
    query: string;
    onChange: (query: string) => void;
}

/**
 * Search input for the GIF picker with auto-focus.
 */
export function GifSearch({ query, onChange }: GifSearchProps): JSX.Element {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>): void => {
            onChange(e.target.value);
        },
        [onChange],
    );

    return (
        <div className="mx_GifPicker_search">
            <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleChange}
                placeholder={_t("composer|gif_search_placeholder")}
            />
        </div>
    );
}
