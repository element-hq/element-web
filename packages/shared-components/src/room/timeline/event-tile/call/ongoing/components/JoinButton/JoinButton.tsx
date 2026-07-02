/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Button } from "@vector-im/compound-web";
import React, { type ComponentProps, type SVGAttributes } from "react";

import { Icon } from "../Icon/Icon";
import type { CallType } from "../../../common";
import { useI18n } from "../../../../../../../core/i18n/i18nContext";

interface Props extends ComponentProps<typeof Button> {
    join: (event: React.MouseEvent<HTMLButtonElement>) => void;
    callType: CallType;
}

function withIcon(callType: CallType) {
    return function ButtonIcon(props: SVGAttributes<SVGGElement>) {
        return <Icon callType={callType} {...props} height={20} width={20} />;
    };
}

/**
 * Join button used by all ongoing call tiles.
 */
export function JoinButton({ join, callType, ...rest }: Props): React.ReactNode {
    const { translate: _t } = useI18n();
    return (
        <Button onClick={join} Icon={withIcon(callType)} size="md" {...rest}>
            {_t("timeline|call_tile|ongoing|common|join_button")}
        </Button>
    );
}
