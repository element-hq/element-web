import React, { ReactElement } from "react";
import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import { InformationCard, InformationCardButtons } from "../../structures/InformationCard";
import { VideoCallSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Button } from "@vector-im/compound-web";

export default function({onFinished}: {onFinished: (confirmed: boolean) => void}): ReactElement {
    return  <BaseDialog
            onFinished={() => onFinished(false)}
            contentId="mx_Dialog_content"
            hasCancel={true}
            fixedWidth={true}
        >
        <InformationCard title={_t("voip|enable_call_dialog|title")} description={_t("voip|enable_call_dialog|description")} Icon={VideoCallSolidIcon} border={false}>
            <InformationCardButtons>
                <Button onClick={() => onFinished(true)} autoFocus kind="primary" className="">
                    {_t("voip|enable_call_dialog|accept_button")}
                </Button>
                <Button onClick={() => onFinished(false)} kind="secondary">
                    {_t("action|cancel")}
                </Button>
            </InformationCardButtons>
        </InformationCard>
    </BaseDialog>
}