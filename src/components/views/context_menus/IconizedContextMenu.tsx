/*
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import classNames from "classnames";

import {
    ChevronFace,
    ContextMenu,
    IProps as IContextMenuProps,
    MenuItem,
    MenuItemCheckbox, MenuItemRadio,
} from "../../structures/ContextMenu";

interface IProps extends IContextMenuProps {
    className?: string;
    compact?: boolean;
}

interface IOptionListProps {
    first?: boolean;
    red?: boolean;
    className?: string;
}

interface IOptionProps extends React.ComponentProps<typeof MenuItem> {
    iconClassName?: string;
}

interface ICheckboxProps extends React.ComponentProps<typeof MenuItemCheckbox> {
    iconClassName: string;
}

interface IRadioProps extends React.ComponentProps<typeof MenuItemRadio> {
    iconClassName: string;
}

export const IconizedContextMenuRadio: React.FC<IRadioProps> = ({
    label,
    iconClassName,
    active,
    className,
    ...props
}) => {
    return <MenuItemRadio
        {...props}
        className={classNames(className, {
            mx_IconizedContextMenu_active: active,
        })}
        active={active}
        label={label}
    >
        <span className={classNames("mx_IconizedContextMenu_icon", iconClassName)} />
        <span className="mx_IconizedContextMenu_label">{label}</span>
        {active && <span className="mx_IconizedContextMenu_icon mx_IconizedContextMenu_checked" />}
    </MenuItemRadio>;
};

export const IconizedContextMenuCheckbox: React.FC<ICheckboxProps> = ({
    label,
    iconClassName,
    active,
    className,
    ...props
}) => {
    return <MenuItemCheckbox
        {...props}
        className={classNames(className, {
            mx_IconizedContextMenu_active: active,
        })}
        active={active}
        label={label}
    >
        <span className={classNames("mx_IconizedContextMenu_icon", iconClassName)} />
        <span className="mx_IconizedContextMenu_label">{label}</span>
        {active && <span className="mx_IconizedContextMenu_icon mx_IconizedContextMenu_checked" />}
    </MenuItemCheckbox>;
};

export const IconizedContextMenuOption: React.FC<IOptionProps> = ({label, iconClassName, ...props}) => {
    return <MenuItem {...props} label={label}>
        { iconClassName && <span className={classNames("mx_IconizedContextMenu_icon", iconClassName)} /> }
        <span className="mx_IconizedContextMenu_label">{label}</span>
    </MenuItem>;
};

export const IconizedContextMenuOptionList: React.FC<IOptionListProps> = ({first, red, className, children}) => {
    const classes = classNames("mx_IconizedContextMenu_optionList", className, {
        mx_IconizedContextMenu_optionList_notFirst: !first,
        mx_IconizedContextMenu_optionList_red: red,
    });

    return <div className={classes}>
        {children}
    </div>;
};

const IconizedContextMenu: React.FC<IProps> = ({className, children, compact, ...props}) => {
    const classes = classNames("mx_IconizedContextMenu", className, {
        mx_IconizedContextMenu_compact: compact,
    });

    return <ContextMenu chevronFace={ChevronFace.None} {...props}>
        <div className={classes}>
            { children }
        </div>
    </ContextMenu>;
};

export default IconizedContextMenu;

