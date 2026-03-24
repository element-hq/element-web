/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MouseEventHandler } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type TileErrorViewLayout,
    type TileErrorViewSnapshot as TileErrorViewSnapshotInterface,
    type TileErrorViewModel as TileErrorViewModelInterface,
} from "@element-hq/web-shared-components";

import { _t } from "../../languageHandler";
import Modal from "../../Modal";
import SdkConfig from "../../SdkConfig";
import { BugReportEndpointURLLocal } from "../../IConfigOptions";
import ViewSource from "../../components/structures/ViewSource";
import BugReportDialog from "../../components/views/dialogs/BugReportDialog";

const TILE_ERROR_BUG_REPORT_LABEL = "react-tile-soft-crash";

export interface TileErrorViewModelProps {
    /**
     * Layout variant used by the host timeline.
     */
    layout: TileErrorViewLayout;
    /**
     * Event whose tile failed to render.
     */
    mxEvent: MatrixEvent;
    /**
     * Render error captured by the boundary.
     */
    error: Error;
    /**
     * Whether developer mode is enabled, which controls the view-source action.
     */
    developerMode: boolean;
}

function getBugReportCtaLabel(): string | undefined {
    const bugReportUrl = SdkConfig.get().bug_report_endpoint_url;

    if (!bugReportUrl) {
        return undefined;
    }

    return bugReportUrl === BugReportEndpointURLLocal
        ? _t("bug_reporting|download_logs")
        : _t("bug_reporting|submit_debug_logs");
}

/**
 * Returns the localized view-source action label when developer mode is enabled.
 */
function getViewSourceCtaLabel(developerMode: boolean): string | undefined {
    return developerMode ? _t("action|view_source") : undefined;
}

/**
 * ViewModel for the tile error fallback, providing the snapshot shown when a tile fails to render.
 *
 * The snapshot includes the host timeline layout, the fallback message, the event type,
 * and optional bug-report and view-source action labels. The view model also exposes
 * click handlers for those actions, opening the bug-report or view-source dialog when
 * available.
 */
export class TileErrorViewModel
    extends BaseViewModel<TileErrorViewSnapshotInterface, TileErrorViewModelProps>
    implements TileErrorViewModelInterface
{
    private static readonly computeSnapshot = (props: TileErrorViewModelProps): TileErrorViewSnapshotInterface => ({
        layout: props.layout,
        message: _t("timeline|error_rendering_message"),
        eventType: props.mxEvent.getType(),
        bugReportCtaLabel: getBugReportCtaLabel(),
        viewSourceCtaLabel: getViewSourceCtaLabel(props.developerMode),
    });

    public constructor(props: TileErrorViewModelProps) {
        super(props, TileErrorViewModel.computeSnapshot(props));
    }

    public setLayout(layout: TileErrorViewLayout): void {
        if (this.props.layout === layout) return;

        this.props.layout = layout;

        if (this.snapshot.current.layout !== layout) {
            this.snapshot.merge({ layout });
        }
    }

    public setMxEvent(mxEvent: MatrixEvent): void {
        if (this.props.mxEvent === mxEvent) return;

        this.props = {
            ...this.props,
            mxEvent,
        };

        const nextEventType = mxEvent.getType();
        if (this.snapshot.current.eventType !== nextEventType) {
            this.snapshot.merge({ eventType: nextEventType });
        }
    }

    public setError(error: Error): void {
        if (this.props.error === error) return;

        this.props.error = error;
    }

    public setDeveloperMode(developerMode: boolean): void {
        if (this.props.developerMode === developerMode) return;

        this.props.developerMode = developerMode;

        const nextViewSourceCtaLabel = getViewSourceCtaLabel(developerMode);
        if (this.snapshot.current.viewSourceCtaLabel !== nextViewSourceCtaLabel) {
            this.snapshot.merge({ viewSourceCtaLabel: nextViewSourceCtaLabel });
        }
    }

    public onBugReportClick: MouseEventHandler<HTMLButtonElement> = () => {
        if (!this.snapshot.current.bugReportCtaLabel) {
            return;
        }

        Modal.createDialog(BugReportDialog, {
            label: TILE_ERROR_BUG_REPORT_LABEL,
            error: this.props.error,
        });
    };

    public onViewSourceClick: MouseEventHandler<HTMLButtonElement> = () => {
        if (!this.snapshot.current.viewSourceCtaLabel) {
            return;
        }

        Modal.createDialog(
            ViewSource,
            {
                mxEvent: this.props.mxEvent,
            },
            "mx_Dialog_viewsource",
        );
    };
}
