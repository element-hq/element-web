// https://github.com/docker/metadata-action#bake-definition
target "docker-metadata-action" {}

variable "ELEMENT_VERSION" {
  default = "latest"
}

variable "DATE" {
  validation {
    condition = DATE != ""
    error_message = "DATE must be set"
  }

  validation {
    condition = DATE == regex("\\d{6}", DATE)
    error_message = "The variable 'DATE' must be of format YYMMNN where NN is the build number of the month."
  }
}

variable "BUILD_TAG" {
  default = "${ELEMENT_VERSION}-${DATE}"
}

group "default" {
  targets = [
    "element-web-modules-opendesk-plugin"
  ]
}

target "_common" {
  inherits = ["docker-metadata-action"]
  platforms = [
    "linux/amd64",
    "linux/arm64",
  ]
  context = "."
}

target "_element_web_module_base" {
  inherits = ["_common"]
  dockerfile = "./Dockerfile"
}

target "element-web-modules-opendesk-plugin" {
  inherits = ["_element_web_module_base"]
  tags = [
    "ghcr.io/element-hq/element-web-modules/opendesk-plugin:latest",
    "ghcr.io/element-hq/element-web-modules/opendesk-plugin:${BUILD_TAG}",
    "registry.opencode.de/bmi/opendesk/components/supplier/element/images/opendesk-element-web:${BUILD_TAG}"
  ]
  args = {
    ELEMENT_VERSION = "${ELEMENT_VERSION}"
    BUILD_CONTEXT = "modules/opendesk/element-web"
  }
}