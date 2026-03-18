/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type RedactedBodyViewSnapshot,
    type RedactedBodyViewModel as RedactedBodyViewModelInterface,
} from "@element-hq/web-shared-components";

import { formatFullDate } from "../../DateUtils";
import { _t } from "../../languageHandler";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import SettingsStore from "../../settings/SettingsStore";

export interface RedactedBodyViewModelProps {
    /**
     * The redacted event being rendered.
     */
    mxEvent: MatrixEvent;
}

export class RedactedBodyViewModel
    extends BaseViewModel<RedactedBodyViewSnapshot, RedactedBodyViewModelProps>
    implements RedactedBodyViewModelInterface
{
    private showTwelveHour: boolean;

    private static readonly computeText = ({ mxEvent }: RedactedBodyViewModelProps): string => {
        const redactedBecauseUserId = mxEvent.getUnsigned().redacted_because?.sender;
        if (!redactedBecauseUserId || redactedBecauseUserId === mxEvent.getSender()) {
            return _t("timeline|self_redaction");
        }

        const roomId = mxEvent.getRoomId();
        const room = roomId ? MatrixClientPeg.get()?.getRoom(roomId) : null;
        const sender = room?.getMember(redactedBecauseUserId);

        return _t("timeline|redaction", { name: sender?.name ?? redactedBecauseUserId });
    };

    private static readonly computeTooltip = (mxEvent: MatrixEvent, showTwelveHour: boolean): string | undefined => {
        const redactionTs = mxEvent.getUnsigned().redacted_because?.origin_server_ts;
        if (!redactionTs) {
            return undefined;
        }

        return _t("timeline|redacted|tooltip", {
            date: formatFullDate(new Date(redactionTs), showTwelveHour),
        });
    };

    private static readonly computeSnapshot = (
        props: RedactedBodyViewModelProps,
        showTwelveHour: boolean,
    ): RedactedBodyViewSnapshot => ({
        text: RedactedBodyViewModel.computeText(props),
        tooltip: RedactedBodyViewModel.computeTooltip(props.mxEvent, showTwelveHour),
    });

    public constructor(props: RedactedBodyViewModelProps) {
        const showTwelveHour = SettingsStore.getValue("showTwelveHourTimestamps");

        super(props, RedactedBodyViewModel.computeSnapshot(props, showTwelveHour));

        this.showTwelveHour = showTwelveHour;

        const showTwelveHourWatcherRef = SettingsStore.watchSetting(
            "showTwelveHourTimestamps",
            null,
            (_settingName, _roomId, _level, _newValAtLevel, newVal) => {
                if (this.showTwelveHour === newVal) return;

                this.showTwelveHour = newVal;
                this.updateTooltip();
            },
        );
        this.disposables.track(() => SettingsStore.unwatchSetting(showTwelveHourWatcherRef));
    }

    public setEvent(mxEvent: MatrixEvent): void {
        if (this.props.mxEvent === mxEvent) return;

        this.props = { ...this.props, mxEvent };

        const text = RedactedBodyViewModel.computeText(this.props);
        const tooltip = RedactedBodyViewModel.computeTooltip(this.props.mxEvent, this.showTwelveHour);
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

    private updateTooltip(): void {
        const tooltip = RedactedBodyViewModel.computeTooltip(this.props.mxEvent, this.showTwelveHour);
        if (this.snapshot.current.tooltip !== tooltip) {
            this.snapshot.merge({ tooltip });
        }
    }
}
