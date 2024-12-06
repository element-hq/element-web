/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { ReactNode, type JSX } from "react";
import classNames from "classnames";

import ContextMenu, {
    ChevronFace,
    IProps as IContextMenuProps,
    MenuItem,
    MenuItemCheckbox,
    MenuItemRadio,
} from "../../structures/ContextMenu";
import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton.tsx";

interface IProps extends IContextMenuProps {
    className?: string;
    compact?: boolean;
}

interface IOptionListProps {
    first?: boolean;
    red?: boolean;
    label?: string;
    className?: string;
    children: ReactNode;
}

type IOptionProps<T extends React.ElementType> = React.ComponentProps<typeof AccessibleButton<T>> & {
    iconClassName?: string;
    isDestructive?: boolean;
};

interface ICheckboxProps extends React.ComponentProps<typeof MenuItemCheckbox> {
    iconClassName: string;
    words?: boolean;
}

interface IRadioProps extends React.ComponentProps<typeof MenuItemRadio> {
    iconClassName?: string;
}

export const IconizedContextMenuRadio: React.FC<IRadioProps> = ({
    label,
    iconClassName,
    active,
    className,
    ...props
}) => {
    return (
        <MenuItemRadio
            {...props}
            className={classNames(className, {
                mx_IconizedContextMenu_item: true,
                mx_IconizedContextMenu_active: active,
            })}
            active={active}
            label={label}
        >
            {iconClassName && <span className={classNames("mx_IconizedContextMenu_icon", iconClassName)} />}
            <span className="mx_IconizedContextMenu_label">{label}</span>
            {active && <span className="mx_IconizedContextMenu_icon mx_IconizedContextMenu_checked" />}
        </MenuItemRadio>
    );
};

export const IconizedContextMenuCheckbox: React.FC<ICheckboxProps> = ({
    label,
    iconClassName,
    active,
    className,
    words,
    ...props
}) => {
    let marker: JSX.Element;
    if (words) {
        marker = (
            <span className="mx_IconizedContextMenu_activeText">{active ? _t("common|on") : _t("common|off")}</span>
        );
    } else {
        marker = (
            <span
                className={classNames("mx_IconizedContextMenu_icon", {
                    mx_IconizedContextMenu_checked: active,
                    mx_IconizedContextMenu_unchecked: !active,
                })}
            />
        );
    }

    return (
        <MenuItemCheckbox
            {...props}
            className={classNames(className, {
                mx_IconizedContextMenu_item: true,
                mx_IconizedContextMenu_active: active,
            })}
            active={active}
            label={label}
        >
            <span className={classNames("mx_IconizedContextMenu_icon", iconClassName)} />
            <span className="mx_IconizedContextMenu_label">{label}</span>
            {marker}
        </MenuItemCheckbox>
    );
};

export const IconizedContextMenuOption = <T extends React.ElementType>({
    element,
    label,
    className,
    iconClassName,
    children,
    isDestructive,
    ...props
}: IOptionProps<T>): JSX.Element => {
    return (
        <MenuItem
            {...props}
            element={element ?? "li"}
            className={classNames(className, {
                mx_IconizedContextMenu_item: true,
                mx_IconizedContextMenu_itemDestructive: isDestructive,
            })}
            label={label}
        >
            {iconClassName && <span className={classNames("mx_IconizedContextMenu_icon", iconClassName)} />}
            <span className="mx_IconizedContextMenu_label">{label}</span>
            {children}
        </MenuItem>
    );
};

export const IconizedContextMenuOptionList: React.FC<IOptionListProps> = ({
    first,
    red,
    className,
    label,
    children,
}) => {
    const classes = classNames("mx_IconizedContextMenu_optionList", className, {
        mx_IconizedContextMenu_optionList_notFirst: !first,
        mx_IconizedContextMenu_optionList_red: red,
    });

    return (
        <div className={classes}>
            {label && (
                <div>
                    <span className="mx_IconizedContextMenu_optionList_label">{label}</span>
                </div>
            )}
            {children}
        </div>
    );
};

const IconizedContextMenu: React.FC<React.PropsWithChildren<IProps>> = ({ className, children, compact, ...props }) => {
    const classes = classNames("mx_IconizedContextMenu", className, {
        mx_IconizedContextMenu_compact: compact,
    });

    return (
        <ContextMenu chevronFace={ChevronFace.None} {...props}>
            <ul role="none" className={classes}>
                {children}
            </ul>
        </ContextMenu>
    );
};

export default IconizedContextMenu;
