#===============================================================================
# aloha-network-web Development
# This makefile is for use within a local development context.
#===============================================================================
ALOHA_TALK = aloha-talk-web
ALOHA_TALK_DIR := $(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))

BUILD_TAG ?= latest
ALOHA_TALK_IMAGE := $(ALOHA_TALK):$(BUILD_TAG)

build-talk: ## build docker image
	docker build -t $(ALOHA_TALK_IMAGE) $(ALOHA_TALK_DIR)

push-talk: ## tag and push to image repository
	docker tag $(ALOHA_TALK_IMAGE) gcr.io/aloha-internal/$(ALOHA_TALK_IMAGE)
	docker push gcr.io/aloha-internal/$(ALOHA_TALK_IMAGE)

clean-talk: ## clean build artifacts
	rm -rf $(ALOHA_TALK_DIR)/node_modules
	rm -rf $(ALOHA_TALK_DIR)/lib
	rm -rf $(ALOHA_TALK_DIR)/webapp
	rm -rf $(ALOHA_TALK_DIR)/electron_app/dist

### Kubernetes Deployment
CONTEXT ?= minikube

deploy-talk:
	kubectl --context=$(CONTEXT) \
		apply -f $(ALOHA_TALK_DIR)/devops/contexts/$(CONTEXT)/deployment.yml

undeploy-talk:
	kubectl --context=$(CONTEXT) \
		delete deployment $(ALOHA_TALK)
