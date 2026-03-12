/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type RedactedBodyViewSnapshot,
    type RedactedBodyViewModel as RedactedBodyViewModelInterface,
} from "@element-hq/web-shared-components";

import { formatFullDate } from "../../DateUtils";
import { _t } from "../../languageHandler";

export interface RedactedBodyViewModelProps {
    /**
     * Matrix client used to resolve room members for redaction text.
     */
    client: MatrixClient;
    /**
     * The redacted event being rendered.
     */
    mxEvent: MatrixEvent;
    /**
     * Whether timestamps should be formatted using a 12-hour clock.
     */
    showTwelveHour: boolean;
}

export class RedactedBodyViewModel
    extends BaseViewModel<RedactedBodyViewSnapshot, RedactedBodyViewModelProps>
    implements RedactedBodyViewModelInterface
{
    private static readonly computeText = ({ client, mxEvent }: RedactedBodyViewModelProps): string => {
        const redactedBecauseUserId = mxEvent.getUnsigned().redacted_because?.sender;
        if (!redactedBecauseUserId || redactedBecauseUserId === mxEvent.getSender()) {
            return _t("timeline|self_redaction");
        }

        const roomId = mxEvent.getRoomId();
        const room = roomId ? client.getRoom(roomId) : null;
        const sender = room?.getMember(redactedBecauseUserId);

        return _t("timeline|redaction", { name: sender?.name ?? redactedBecauseUserId });
    };

    private static readonly computeTooltip = ({
        mxEvent,
        showTwelveHour,
    }: RedactedBodyViewModelProps): string | undefined => {
        const redactionTs = mxEvent.getUnsigned().redacted_because?.origin_server_ts;
        if (!redactionTs) {
            return undefined;
        }

        return _t("timeline|redacted|tooltip", {
            date: formatFullDate(new Date(redactionTs), showTwelveHour),
        });
    };

    private static readonly computeSnapshot = (props: RedactedBodyViewModelProps): RedactedBodyViewSnapshot => ({
        text: RedactedBodyViewModel.computeText(props),
        tooltip: RedactedBodyViewModel.computeTooltip(props),
    });

    public constructor(props: RedactedBodyViewModelProps) {
        super(props, RedactedBodyViewModel.computeSnapshot(props));
    }

    public setEvent(mxEvent: MatrixEvent): void {
        if (this.props.mxEvent === mxEvent) return;

        this.props = { ...this.props, mxEvent };

        const text = RedactedBodyViewModel.computeText(this.props);
        const tooltip = RedactedBodyViewModel.computeTooltip(this.props);
        const updates: Partial<RedactedBodyViewSnapshot> = {};

        if (this.snapshot.current.text !== text) {
            updates.text = text;
        }
        if (this.snapshot.current.tooltip !== tooltip) {
            updates.tooltip = tooltip;
        }

        if (Object.keys(updates).length > 0) {
            this.snapshot.merge(updates);
        }
    }

    public setShowTwelveHour(showTwelveHour: boolean): void {
        if (this.props.showTwelveHour === showTwelveHour) return;

        this.props = { ...this.props, showTwelveHour };

        const tooltip = RedactedBodyViewModel.computeTooltip(this.props);
        if (this.snapshot.current.tooltip !== tooltip) {
            this.snapshot.merge({ tooltip });
        }
    }
}
