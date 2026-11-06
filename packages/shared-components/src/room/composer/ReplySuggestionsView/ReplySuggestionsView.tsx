/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import AiIcon from "@vector-im/compound-design-tokens/assets/web/icons/ai";

import styles from "./ReplySuggestionsView.module.css";
import { type ViewModel, useViewModel } from "../../../core/viewmodel";
import { Flex } from "../../../core/utils/Flex";
import { useI18n } from "../../../core/i18n/i18nContext";

export interface ReplySuggestionsViewSnapshot {
    /**
     * The replies the user could send next. Nothing is shown while there are none.
     */
    suggestions: string[];
    /**
     * Whether new suggestions are being written. Placeholders are shown meanwhile.
     */
    loading: boolean;
}

export interface ReplySuggestionsViewActions {
    /**
     * Called when the user picks a suggestion.
     */
    onSuggestionClick: (suggestion: string) => void;
}

/**
 * The view model for the reply suggestions.
 */
export type ReplySuggestionsViewModel = ViewModel<ReplySuggestionsViewSnapshot, ReplySuggestionsViewActions>;

interface ReplySuggestionsViewProps {
    /**
     * The view model for the reply suggestions.
     */
    vm: ReplySuggestionsViewModel;
}

/** How many placeholders are shown while suggestions are being written */
const PLACEHOLDER_COUNT = 3;

/**
 * A row of replies the user could send next, shown above the message composer.
 *
 * @example
 * ```tsx
 * <ReplySuggestionsView vm={replySuggestionsViewModel} />
 * ```
 */
export function ReplySuggestionsView({ vm }: Readonly<ReplySuggestionsViewProps>): JSX.Element | null {
    const { translate: _t } = useI18n();
    const { suggestions, loading } = useViewModel(vm);
    if (!loading && suggestions.length === 0) return null;

    return (
        <Flex
            className={styles.view}
            role="group"
            aria-label={_t("composer|reply_suggestions|label")}
            aria-busy={loading}
            align="center"
            gap="var(--cpd-space-2x)"
        >
            <AiIcon className={styles.icon} width="16px" height="16px" aria-hidden />
            {loading
                ? Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
                      <span key={i} className={styles.placeholder} data-testid="reply-suggestion-placeholder" />
                  ))
                : suggestions.map((suggestion) => (
                      <button
                          key={suggestion}
                          type="button"
                          className={styles.suggestion}
                          title={suggestion}
                          onClick={() => vm.onSuggestionClick(suggestion)}
                      >
                          {suggestion}
                      </button>
                  ))}
        </Flex>
    );
}
