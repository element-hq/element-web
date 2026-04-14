/*
 * Copyright (c) 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, {
    type ReactElement,
    type PropsWithChildren,
    useState,
    type ComponentProps,
    SVGAttributes,
    ComponentType,
} from "react";
import { IconButton, Menu, MenuItem } from "@vector-im/compound-web";

// import styles from "./UploadButton.module.css";

export interface MultiOptionButtonProps {
    options: {
        label: string;
        icon: ComponentType<SVGAttributes<SVGElement>>;
        onSelect: () => void;
    }[];
    multipleOptionsButton: {
        label: string;
        icon: ComponentType<SVGAttributes<SVGElement>>;
    };
}

/**
 * A button that may have one or more options that the user can select.
 *
 * @example
 * ```tsx
 *   <MultiOptionButton options{[...]} multipleOptionsButton={{label: "Your options", icon: Icon}} />
 * ```
 */
export function MultiOptionButton({
    options,
    multipleOptionsButton,
    ...rootButtonProps
}: PropsWithChildren<MultiOptionButtonProps & ComponentProps<typeof IconButton>>): ReactElement | null {
    const [open, setOpen] = useState(false);
    if (options.length === 0) {
        return null;
    } else if (options.length === 1) {
        const { label, icon: Icon, onSelect } = options[0];
        return (
            <IconButton {...rootButtonProps} title={label} onClick={() => onSelect()}>
                <Icon />
            </IconButton>
        );
    }

    const Icon = multipleOptionsButton.icon;
    const trigger = (
        <IconButton {...rootButtonProps} title={multipleOptionsButton.label}>
            <Icon />
        </IconButton>
    );

    return (
        <Menu title={multipleOptionsButton.label} trigger={trigger} open={open} onOpenChange={(o) => setOpen(o)}>
            {options.map((o) => (
                <MenuItem key={o.label} label={o.label} Icon={o.icon} onSelect={() => o.onSelect()} />
            ))}
        </Menu>
    );
}
