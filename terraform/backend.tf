terraform {
  backend "s3" {
    bucket         = "voicedrop-web-terraform-state"
    key            = "web-client/terraform.tfstate"
    region         = "eu-central-1"
    encrypt        = true
    acl            = "bucket-owner-full-control"
  }
}
