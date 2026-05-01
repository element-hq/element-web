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
    type SVGAttributes,
    type ComponentType,
    useCallback,
    type MouseEventHandler,
} from "react";
import { IconButton, Menu, MenuItem } from "@vector-im/compound-web";
import { AttachmentIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { useI18n } from "../../../core/i18n/i18nContext";
import { useViewModel, type ViewModel } from "../../../core/viewmodel";

export interface UploadButtonViewSnapshot {
    mayUpload: boolean;
    options: { type: string; label: string; icon: ComponentType<SVGAttributes<SVGElement>> }[];
}

export interface UploadButtonViewActions {
    onUploadOptionSelected(type: string): void;
}

/**
 * A button that may have one or more options that the user can select.
 *
 * @example
 * ```tsx
 *   <UploadButton vm={} />
 * ```
 */
export function UploadButton({
    vm,
    ...rootButtonProps
}: PropsWithChildren<
    { vm: ViewModel<UploadButtonViewSnapshot, UploadButtonViewActions> } & ComponentProps<typeof IconButton>
>): ReactElement {
    const i18n = useI18n();
    const [open, setOpen] = useState(false);
    const { options } = useViewModel(vm);
    // Shift click is a shortcut to selecting the first item.
    const onMenuClick: MouseEventHandler<HTMLButtonElement> = useCallback(
        (ev) => {
            if (!ev.shiftKey) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            vm.onUploadOptionSelected(options[0].type);
        },
        [options, vm],
    );
    if (options.length === 1) {
        const { label, icon: Icon } = options[0];
        return (
            <IconButton
                tooltip={label}
                {...rootButtonProps}
                title={label}
                onClick={() => vm.onUploadOptionSelected(options[0].type)}
            >
                <Icon />
            </IconButton>
        );
    }

    const trigger = (
        <IconButton
            tooltip={i18n.translate("common|attachment")}
            onClick={onMenuClick}
            {...rootButtonProps}
            title={i18n.translate("common|attachment")}
        >
            <AttachmentIcon />
        </IconButton>
    );

    return (
        <Menu
            side="top"
            title={i18n.translate("composer|attachment_button_label")}
            trigger={trigger}
            open={open}
            onOpenChange={(o) => setOpen(o)}
        >
            {options.map((o) => (
                <MenuItem
                    key={o.label}
                    label={o.label}
                    Icon={o.icon}
                    onSelect={() => vm.onUploadOptionSelected(o.type)}
                />
            ))}
        </Menu>
    );
}
