import classNames from "classnames";
import AccessibleTooltipButton from "matrix-react-sdk/src/components/views/elements/AccessibleTooltipButton";
import { _t } from "matrix-react-sdk/src/languageHandler";
import React, { useCallback } from "react";

const MintTokenButton: React.FC<{
    isPanelCollapsed: boolean;
}> = ({ isPanelCollapsed = false }) => {
    const MINT_TOKEN_URL = "https://wallet.superhero.com/";

    const onOpenDex = useCallback(async () => {
        window.open(MINT_TOKEN_URL, "_blank");
    }, []);

    return (
        <>
            <AccessibleTooltipButton
                className={classNames("mx_QuickSettingsButton", "sh_MintTokenButton", {
                    expanded: !isPanelCollapsed,
                })}
                onClick={onOpenDex}
                title={_t('mint_a_token')}
                forceHide={!isPanelCollapsed}
                aria-expanded={!isPanelCollapsed}
            >
                {!isPanelCollapsed ? _t('mint_a_token') : null}
            </AccessibleTooltipButton>
        </>
    );
};

export default MintTokenButton;
