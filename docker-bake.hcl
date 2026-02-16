// https://github.com/docker/metadata-action#bake-definition
target "docker-metadata-action" {}

variable "PLAYWRIGHT_VERSION" {
    validation {
        condition = PLAYWRIGHT_VERSION == regex("\\d+\\.\\d+\\.\\d+", PLAYWRIGHT_VERSION)
        error_message = "The variable 'PLAYWRIGHT_VERSION' must be of semver format."
    }
}

target "playwright-server" {
    inherits = ["docker-metadata-action"]
    platforms = [
        "linux/amd64",
        "linux/arm64",
    ]
    context = "packages/playwright-common"
    tags = [
        "ghcr.io/element-hq/element-web/playwright-server:${PLAYWRIGHT_VERSION}",
    ]
    args = {
        PLAYWRIGHT_VERSION = PLAYWRIGHT_VERSION
    }
}

group "default" {
    targets = [
        "playwright-server"
    ]
}
