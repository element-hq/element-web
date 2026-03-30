/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Button, Tooltip } from "@vector-im/compound-web";

import styles from "./ActionBarView.module.css";

interface ActionBarButtonProps {
    presentation: "icon" | "label";
    buttonRef: React.RefObject<HTMLButtonElement | null>;
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

    const handleContextMenu = (event: React.MouseEvent<HTMLButtonElement>): void => {
        event.preventDefault();
        event.stopPropagation();
        onActivate?.(buttonRef.current);
    };

    return (
        <Tooltip description={tooltipDescription ?? label} caption={tooltipCaption} placement="top">
            <Button
                data-presentation={presentation}
                ref={buttonRef}
                kind="tertiary"
                size="sm"
                iconOnly={iconOnly}
                aria-label={label}
                aria-pressed={ariaPressed}
                aria-expanded={ariaExpanded}
                disabled={disabled}
                onClick={() => onActivate?.(buttonRef.current)}
                onContextMenu={handleContextMenu}
                className={styles.toolbar_item}
                Icon={iconOnly ? icon : undefined}
            >
                {iconOnly ? undefined : label}
            </Button>
        </Tooltip>
    );
}
