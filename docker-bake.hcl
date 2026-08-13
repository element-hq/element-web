# Builds the Element Web images. Both targets share the `builder` and `element_web` stages,
# building them together in a single bake invocation compiles the app only once.
#
#   docker buildx bake                      # both images, for the local platform
#   docker buildx bake element-web          # just the base image
#   PLATFORMS=linux/amd64,linux/arm64 docker buildx bake --push

variable "PLATFORMS" {
    default = ""
}

# Populated by docker/metadata-action in CI; empty locally.
target "docker-metadata-action" {}
target "docker-metadata-action-modules" {}

target "_common" {
    context    = "."
    dockerfile = "apps/web/Dockerfile"
    platforms  = PLATFORMS == "" ? null : split(",", PLATFORMS)
}

# The stock image, with no modules bundled.
target "element-web" {
    inherits = ["_common", "docker-metadata-action"]
    target   = "element_web"
}

# The same image with the released Element modules baked into /modules,
# where the entrypoint picks them up and adds them to config.json.
target "element-web-modules" {
    inherits = ["_common", "docker-metadata-action-modules"]
    target   = "element_web_modules"
}

group "default" {
    targets = ["element-web", "element-web-modules"]
}
