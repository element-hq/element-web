import SettingController from "./SettingController";
import { type SettingLevel } from "../SettingLevel";
import type BasePlatform from "../../BasePlatform";


export class RegisterProtocolHandlerController extends SettingController {
    private platform: BasePlatform | undefined;
    private platformSupported = false;
    public constructor(private platformPromise: Promise<BasePlatform>) {
        super();
        void (async () => {
            console.log("Hello world?!");
            this.platform = await this.platformPromise;
            this.platformSupported = await this.platform.supportsRegisterProtocolHandler();
            console.log("this.platformSupported", this.platformSupported);
        })();
    }

    // public get settingDisabled(): string | boolean {
    //     console.log("checking setting disabled", this.platformSupported);
    //     return !this.platformSupported;
    // }

    public async beforeChange(level: SettingLevel, roomId: string | null, newValue: boolean): Promise<boolean> {
        if (newValue !== true || !this.platform) {
            // How to unregister?
            return false;
        }

        return await this.platform.registerProtocolHandler();
    }
}
