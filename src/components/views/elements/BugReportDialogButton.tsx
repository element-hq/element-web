import React, { useCallback } from "react";
import { Button } from "@vector-im/compound-web";
import SdkConfig from "../../../SdkConfig";
import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import BugReportDialog, { BugReportDialogProps } from "../dialogs/BugReportDialog";

/**
 * Renders a button to open the BugReportDialog *if* the configuration
 * supports it.
 */
export function BugReportDialogButton({
    label,
    error,
}: Pick<BugReportDialogProps, "label" | "error">): React.ReactElement | null {
    const bugReportUrl = SdkConfig.get().bug_report_endpoint_url;
    const onClick = useCallback(() => {
        Modal.createDialog(BugReportDialog, {
            label,
            error,
        });
    }, [label, error]);

    if (!bugReportUrl) {
        return null;
    }
    return (
        <Button kind="secondary" size="sm" onClick={onClick}>
            {bugReportUrl === "local" ? _t("bug_reporting|download_logs") : _t("bug_reporting|submit_debug_logs")}
        </Button>
    );
}
