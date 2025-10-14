/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import React, { type JSX, useEffect, useMemo } from "react";

import { BaseViewModel } from "../../../viewmodels/base/BaseViewModel";
import {
    type WidgetCardViewSnapshot,
    type WidgetCardViewModel as WidgetCardViewModelInterface,
    WidgetCardView,
} from "../../../../packages/shared-components/src/right-panel/WidgetCardView/WidgetCardView";
import WidgetUtils, { useWidgets } from "../../../utils/WidgetUtils";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { Container, WidgetLayoutStore } from "../../../stores/widgets/WidgetLayoutStore";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { type IApp } from "../../../utils/WidgetUtils-types";


interface WidgetCardProps {
    room: Room;
    widgetId: string;
    onClose(): void;
}

type WidgetCardViewModelProps = WidgetCardProps & {
    apps: IApp[];
}

export class WidgetCardViewModel
    extends BaseViewModel<WidgetCardViewSnapshot, WidgetCardViewModelProps>
    implements WidgetCardViewModelInterface
{
    private cli: MatrixClient | null;

    public static computeSnapshot = (
        props: WidgetCardViewModelProps & { cli: MatrixClient | null },
    ): WidgetCardViewSnapshot => {
        const { room, widgetId } = props;

        const app = props.apps.find((a) => a.id === widgetId);
        const isRight = app && WidgetLayoutStore.instance.isInContainer(room, app, Container.Right);
        let shouldEmptyWidgetCard = !isRight;

        if (!app || !isRight) {
            // stop showing this card
            RightPanelStore.instance.popCard();
            shouldEmptyWidgetCard = true;
        }

        return {
            room,
            app,    
            creatorUserId: app ? app.creatorUserId : undefined,
            widgetPageTitle: WidgetUtils.getWidgetDataTitle(app),
            userId: props.cli!.getSafeUserId(),
            widgetName: WidgetUtils.getWidgetName(app),
            shouldEmptyWidgetCard,
        };
    };

    public constructor(props: WidgetCardViewModelProps) {
        const cli = MatrixClientPeg?.get();
        super(props, WidgetCardViewModel.computeSnapshot({ ...props, cli }));
        this.cli = cli;
    }

    public onClose = (): void => {
        this.snapshot.set({
            room: this.props.room,
            app: undefined,
            creatorUserId: undefined,
            widgetPageTitle: WidgetUtils.getWidgetDataTitle(),
            userId: this.cli!.getSafeUserId(),
            widgetName: WidgetUtils.getWidgetName(),
            shouldEmptyWidgetCard: true,
        });
        this.props.onClose();
    };
}

/**
 * WidgetCard component that initializes the WidgetCardViewModel and renders the WidgetCardView.
 */
export function WidgetCard(props: WidgetCardProps): JSX.Element {
    const { room, widgetId, onClose } = props;
    const apps = useWidgets(props.room);
    const vm = useMemo(() => new WidgetCardViewModel({ room, widgetId, apps, onClose }), [apps, room, widgetId, onClose]);

    useEffect(() => {
        return () => {
            vm.dispose();
        };
    }, [vm]);

    return <WidgetCardView vm={vm} />;
}
