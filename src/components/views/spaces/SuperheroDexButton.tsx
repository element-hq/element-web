import classNames from "classnames";
import AccessibleTooltipButton from "matrix-react-sdk/src/components/views/elements/AccessibleTooltipButton";
import React, { useCallback } from "react";

import { _t } from "../../../languageHandler";

const SuperheroDexButton: React.FC<{
    isPanelCollapsed: boolean;
}> = ({ isPanelCollapsed = false }) => {
    const DEX_URL = "https://aepp.dex.superhero.com/";

    const onOpenDex = useCallback(async () => {
        window.open(DEX_URL, "_blank");
    }, []);

    return (
        <>
            <AccessibleTooltipButton
                className={classNames("mx_QuickSettingsButton", "sh_SuperheroDexButton", {
                    expanded: !isPanelCollapsed,
                })}
                onClick={onOpenDex}
                title={_t("superhero_dex")}
                forceHide={!isPanelCollapsed}
                aria-expanded={!isPanelCollapsed}
            >
                {!isPanelCollapsed ? _t("superhero_dex") : null}
            </AccessibleTooltipButton>
        </>
    );
};

export default SuperheroDexButton;
