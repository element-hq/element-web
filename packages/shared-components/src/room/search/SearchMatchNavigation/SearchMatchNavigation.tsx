/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { IconButton } from "@vector-im/compound-web";
import ChevronUpIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-up";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";

import styles from "./SearchMatchNavigation.module.css";
import { type ViewModel, useViewModel } from "../../../core/viewmodel";
import { Flex } from "../../../core/utils/Flex";
import { useI18n } from "../../../core/i18n/i18nContext";

export interface SearchMatchNavigationViewSnapshot {
    /**
     * The 1-based position of the currently-focused match, or 0 when no match is active.
     */
    current: number;
    /**
     * The total number of matches that can be stepped through.
     */
    total: number;
    /**
     * Whether stepping to the previous (newer) match is possible.
     */
    canPrevious: boolean;
    /**
     * Whether stepping to the next (older) match is possible.
     */
    canNext: boolean;
}

export interface SearchMatchNavigationViewActions {
    /**
     * Step to the previous (newer) match in the timeline.
     */
    previous(): void;
    /**
     * Step to the next (older) match in the timeline.
     */
    next(): void;
}

/**
 * The view model for the in-room search match navigation component.
 */
export type SearchMatchNavigationViewModel = ViewModel<
    SearchMatchNavigationViewSnapshot,
    SearchMatchNavigationViewActions
>;

interface SearchMatchNavigationProps {
    /**
     * The view model for the in-room search match navigation component.
     */
    vm: SearchMatchNavigationViewModel;
}

/**
 * A compact "k of N" counter flanked by up/down arrows for stepping through in-room search matches in the
 * live timeline. Renders nothing when there are no matches to step through.
 *
 * @example
 * ```tsx
 * <SearchMatchNavigation vm={roomSearchNavigationViewModel} />
 * ```
 */
export function SearchMatchNavigation({ vm }: Readonly<SearchMatchNavigationProps>): JSX.Element | null {
    const { translate: _t } = useI18n();
    const { current, total, canPrevious, canNext } = useViewModel(vm);

    if (total === 0) return null;

    return (
        <Flex
            className={styles.navigation}
            align="center"
            gap="var(--cpd-space-1x)"
            data-testid="search-match-navigation"
        >
            <span className={styles.counter}>{_t("room|search|match_position", { current, total })}</span>
            <IconButton
                size="28px"
                disabled={!canPrevious}
                onClick={() => vm.previous()}
                tooltip={_t("room|search|previous_match")}
                aria-label={_t("room|search|previous_match")}
            >
                <ChevronUpIcon width="20px" height="20px" />
            </IconButton>
            <IconButton
                size="28px"
                disabled={!canNext}
                onClick={() => vm.next()}
                tooltip={_t("room|search|next_match")}
                aria-label={_t("room|search|next_match")}
            >
                <ChevronDownIcon width="20px" height="20px" />
            </IconButton>
        </Flex>
    );
}
