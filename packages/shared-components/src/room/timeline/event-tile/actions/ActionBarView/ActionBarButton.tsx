/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useLayoutEffect, useRef } from "react";
import { useMergeRefs } from "react-merge-refs";
import { Button, Tooltip } from "@vector-im/compound-web";

import { useRovingTabIndex } from "../../../../../core/roving";
import styles from "./ActionBarView.module.css";

interface ActionBarButtonProps {
    presentation: "icon" | "label";
    buttonRef: React.Ref<HTMLButtonElement>;
    label: string;
    onActivate?: (anchor: HTMLElement | null) => void;
    icon?: React.ComponentProps<typeof Button>["Icon"];
    disabled?: boolean;
    ariaPressed?: boolean;
    ariaExpanded?: boolean;
    tooltipDescription?: string;
    tooltipCaption?: string;
}

export function ActionBarButton({
    presentation,
    buttonRef,
    label,
    onActivate,
    icon,
    disabled,
    ariaPressed,
    ariaExpanded,
    tooltipDescription,
    tooltipCaption,
}: Readonly<ActionBarButtonProps>): JSX.Element {
    const iconOnly = presentation === "icon";
    const [onFocus, isActive, rovingRef] = useRovingTabIndex<HTMLButtonElement>();
    const localRef = useRef<HTMLButtonElement | null>(null);
    const ref = useMergeRefs([buttonRef, localRef, disabled ? null : rovingRef]);

    useLayoutEffect(() => {
        if (!localRef.current) return;

        localRef.current.tabIndex = disabled ? -1 : isActive ? 0 : -1;
    }, [disabled, isActive]);

    const handleContextMenu = (event: React.MouseEvent<HTMLButtonElement>): void => {
        event.preventDefault();
        event.stopPropagation();
        onActivate?.(event.currentTarget);
    };

    return (
        <Tooltip description={tooltipDescription ?? label} caption={tooltipCaption} placement="top">
            <Button
                data-presentation={presentation}
                ref={ref}
                kind="tertiary"
                size="sm"
                iconOnly={iconOnly}
                aria-label={label}
                aria-pressed={ariaPressed}
                aria-expanded={ariaExpanded}
                disabled={disabled}
                onClick={(event) => onActivate?.(event.currentTarget)}
                onContextMenu={handleContextMenu}
                onFocus={disabled ? undefined : onFocus}
                className={styles.toolbar_item}
                Icon={iconOnly ? icon : undefined}
            >
                {iconOnly ? undefined : label}
            </Button>
        </Tooltip>
    );
}
