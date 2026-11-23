/*
 * Copyright 2026
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode, useEffect, useRef } from "react";
import classNames from "classnames";
import { Button, Tooltip } from "@vector-im/compound-web";
import { ChevronLeftIcon, ChevronRightIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { type ViewModel, useViewModel } from "../../core/viewmodel";
import { useI18n } from "../../core/i18n/i18nContext";
import styles from "./LightboxNavigationView.module.css";

export interface LightboxNavigationViewSnapshot {
    /**
     * Whether the user can go to a previous (older) image. A "Previous" button is shown when true.
     */
    canGoToPrevious: boolean;
    /**
     * Whether the user can go to a next (newer) image. A "Next" button is shown when true.
     */
    canGoToNext: boolean;
    /**
     * Whether a navigation is in progress (e.g. older history is being fetched). The buttons are
     * disabled meanwhile.
     */
    isNavigating: boolean;
}

export interface LightboxNavigationViewActions {
    /**
     * Go to the previous (older) image.
     */
    goToPrevious: () => void;
    /**
     * Go to the next (newer) image.
     */
    goToNext: () => void;
}

/**
 * The view model for {@link LightboxNavigationView}.
 */
export type LightboxNavigationViewModel = ViewModel<LightboxNavigationViewSnapshot, LightboxNavigationViewActions>;

interface LightboxNavigationViewProps {
    /**
     * The view model providing the navigation state and actions.
     */
    vm: LightboxNavigationViewModel;
    /**
     * The content shown between the previous and next buttons, usually the image.
     */
    children: ReactNode;
    /**
     * Optional class name for the root element.
     */
    className?: string;
}

/**
 * Previous/next navigation for the image lightbox. Lays out its children (the image) between a
 * gutter on either side that holds the "Previous" and "Next" buttons, so the buttons never cover
 * the image. Both gutters are kept while either button is shown so the image stays centred.
 *
 * Keyboard navigation (the arrow keys) is left to the lightbox, which owns the keyboard handling
 * for the whole dialog. If a focused button disappears because the first or last image was
 * reached, focus moves to the other button (or this view) so it stays inside the lightbox.
 *
 * @example
 * ```tsx
 * <LightboxNavigationView vm={lightboxNavigationViewModel}>
 *     <img src={src} alt={name} />
 * </LightboxNavigationView>
 * ```
 */
export function LightboxNavigationView({
    vm,
    children,
    className,
}: Readonly<LightboxNavigationViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const { canGoToPrevious, canGoToNext, isNavigating } = useViewModel(vm);

    const rootRef = useRef<HTMLDivElement>(null);
    const previousRef = useRef<HTMLButtonElement>(null);
    const nextRef = useRef<HTMLButtonElement>(null);
    const shown = useRef({ canGoToPrevious, canGoToNext });

    useEffect(() => {
        const lostPrevious = shown.current.canGoToPrevious && !canGoToPrevious;
        const lostNext = shown.current.canGoToNext && !canGoToNext;
        shown.current = { canGoToPrevious, canGoToNext };
        if (!lostPrevious && !lostNext) return;
        // Only step in when focus fell out with the removed button
        if (document.activeElement && document.activeElement !== document.body) return;

        const fallback = (lostNext ? previousRef.current : nextRef.current) ?? rootRef.current;
        fallback?.focus();
    }, [canGoToPrevious, canGoToNext]);

    const showNavigation = canGoToPrevious || canGoToNext;

    return (
        <div ref={rootRef} className={classNames(styles.navigation, className)} tabIndex={-1}>
            {showNavigation && (
                <div className={classNames(styles.gutter, "cpd-theme-dark")}>
                    {canGoToPrevious && (
                        <Tooltip label={_t("action|previous")}>
                            <Button
                                ref={previousRef}
                                iconOnly
                                kind="secondary"
                                size="lg"
                                Icon={ChevronLeftIcon}
                                aria-label={_t("action|previous")}
                                onClick={vm.goToPrevious}
                                disabled={isNavigating}
                            />
                        </Tooltip>
                    )}
                </div>
            )}
            {children}
            {showNavigation && (
                <div className={classNames(styles.gutter, "cpd-theme-dark")}>
                    {canGoToNext && (
                        <Tooltip label={_t("action|next")}>
                            <Button
                                ref={nextRef}
                                iconOnly
                                kind="secondary"
                                size="lg"
                                Icon={ChevronRightIcon}
                                aria-label={_t("action|next")}
                                onClick={vm.goToNext}
                                disabled={isNavigating}
                            />
                        </Tooltip>
                    )}
                </div>
            )}
        </div>
    );
}
