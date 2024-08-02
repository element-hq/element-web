import TestEnvironment from "@jest/environment-jsdom-abstract";

type Params = TestEnvironment["constructor"]["arguments"];

export default class JSDOMEnv extends TestEnvironment {
    constructor(config: Params[0], context: Params[1]) {
        super(config, context, require("jsdom"));
    }
}
