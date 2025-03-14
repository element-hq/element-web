import React, { MouseEventHandler } from "react";
import { _t } from "../../../languageHandler";
import { VisibilityOnIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

interface IProps {
    kind: "m.image"|"m.video";
    onClick: MouseEventHandler<HTMLAnchorElement>;
}

const HiddenMediaPlaceholder: React.FunctionComponent<IProps> = (props) => {
    return (
        <a role="button" onClick={props.onClick} className="mx_HiddenMediaPlaceholder">
            <div>
                <VisibilityOnIcon />
                <span>{props.kind === "m.image" ? _t("timeline|m.image|show_image") : _t("timeline|m.video|show_video")}</span>
            </div>
        </a>
    );
}

export default HiddenMediaPlaceholder;