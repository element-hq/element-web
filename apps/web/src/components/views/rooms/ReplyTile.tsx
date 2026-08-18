/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 Tulir Asokan <tulir@maunium.net>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { ReplyTileView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { type GetRelationsForEvent } from "../rooms/EventTile";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { ReplyTileViewModel } from "../../../viewmodels/room/timeline/event-tile/ReplyTileViewModel";
import { useUserStatus } from "../../../hooks/useUserStatus";

interface IProps {
    mxEvent: MatrixEvent;
    permalinkCreator?: RoomPermalinkCreator;
    highlights?: string[];
    highlightLink?: string;
    toggleExpandedQuote?: () => void;
    getRelationsForEvent?: GetRelationsForEvent;
}

export default function ReplyTile({
    mxEvent,
    permalinkCreator,
    highlights,
    highlightLink,
    toggleExpandedQuote,
    getRelationsForEvent,
}: IProps): React.ReactNode {
    const cli = MatrixClientPeg.safeGet();
    const userStatus = useUserStatus(mxEvent.getSender() ?? mxEvent.sender?.userId);
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new ReplyTileViewModel({
                mxEvent,
                permalinkCreator,
                highlights,
                highlightLink,
                toggleExpandedQuote,
                getRelationsForEvent,
                cli,
                userStatus,
            }),
    );

    useEffect(() => {
        vm.setProps({
            mxEvent,
            permalinkCreator,
            highlights,
            highlightLink,
            toggleExpandedQuote,
            getRelationsForEvent,
            cli,
            userStatus,
        });
    }, [
        cli,
        getRelationsForEvent,
        highlightLink,
        highlights,
        mxEvent,
        permalinkCreator,
        toggleExpandedQuote,
        userStatus,
        vm,
    ]);

    return <ReplyTileView vm={vm} />;
}
