/*
Copyright 2019-2022 The Matrix.org Foundation C.I.C.
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>

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

import React, { useEffect, useRef } from "react";

import { _t } from "../../../languageHandler";
import { copyPlaintext } from "../../../utils/strings";
import { toRightOf, createMenu } from "../../structures/ContextMenu";
import GenericTextContextMenu from "../context_menus/GenericTextContextMenu";
import { ButtonEvent } from "./AccessibleButton";
import AccessibleTooltipButton from "./AccessibleTooltipButton";

interface IProps {
    children: React.ReactNode;
    getTextToCopy: () => string;
}

const CopyableText: React.FC<IProps> = ({ children, getTextToCopy }) => {
    const closeCopiedTooltip = useRef<() => void>();
    const divRef = useRef<HTMLDivElement>();

    useEffect(() => () => {
        if (closeCopiedTooltip.current) closeCopiedTooltip.current();
    }, [closeCopiedTooltip]);

    const onCopyClickInternal = async (e: ButtonEvent) => {
        e.preventDefault();
        const target = e.target as HTMLDivElement; // copy target before we go async and React throws it away

        const successful = await copyPlaintext(getTextToCopy());
        const buttonRect = target.getBoundingClientRect();
        const { close } = createMenu(GenericTextContextMenu, {
            ...toRightOf(buttonRect, 2),
            message: successful ? _t('Copied!') : _t('Failed to copy'),
        });
        closeCopiedTooltip.current = target.onmouseleave = close;
    };

    return <div className="mx_CopyableText" ref={divRef}>
        { children }
        <AccessibleTooltipButton
            title={_t("Copy")}
            onClick={onCopyClickInternal}
            className="mx_CopyableText_copyButton"
        />
    </div>;
};

export default CopyableText;
