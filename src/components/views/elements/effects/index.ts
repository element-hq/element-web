import { _t, _td } from "../../../../languageHandler";

export type Effect = {
    emojis: Array<string>;
    msgType: string;
    command: string;
    description: () => string;
    fallbackMessage: () => string;
    options: {
        [key: string]: any
    }
}

type ConfettiOptions = {
    maxCount: number,
    speed: number,
    frameInterval: number,
    alpha: number,
    gradient: boolean,
}

const effects: Array<Effect> = [
    {
        emojis: ['🎊', '🎉'],
        msgType: 'nic.custom.confetti',
        command: 'confetti',
        description: () => _td("Sends the given message with confetti"),
        fallbackMessage: () => _t("sends confetti") + " 🎉",
        options: {
            //set max confetti count
            maxCount: 150,
            //syarn addet the particle animation speed
            speed: 3,
            //the confetti animation frame interval in milliseconds
            frameInterval: 15,
            //the alpha opacity of the confetti (between 0 and 1, where 1 is opaque and 0 is invisible)
            alpha: 1.0,
            //use gradient instead of solid particle color
            gradient: false,
        } as ConfettiOptions,
    },
];

export default effects;


